"""Numerical cross-validation for extracted data.

Runs deterministic consistency checks on extracted numerical values to catch
transcription errors and hallucinated numbers.
"""

import logging

logger = logging.getLogger(__name__)


def validate_extraction(data: dict) -> list[dict]:
    """Run all validation checks on extracted data. Returns list of warnings."""
    warnings = []
    warnings.extend(_check_sample_size_consistency(data))
    warnings.extend(_check_events_vs_sample_size(data))
    warnings.extend(_check_ci_consistency(data))
    warnings.extend(_check_effect_size_plausibility(data))
    return warnings


def _get_field_value(field_data):
    """Extract the raw value from either new format (dict with 'value') or old format."""
    if isinstance(field_data, dict) and "value" in field_data:
        return field_data["value"]
    return field_data


def _try_float(val) -> float | None:
    """Try to convert a value to float."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _check_sample_size_consistency(data: dict) -> list[dict]:
    """Check that intervention + control sample sizes ≈ total sample size."""
    warnings = []
    pop = data.get("population", {})
    total_n = _try_float(_get_field_value(pop.get("sample_size")))
    if total_n is None:
        return warnings

    outcomes = data.get("outcomes", [])
    if not isinstance(outcomes, list):
        return warnings

    for i, outcome in enumerate(outcomes):
        n_int = _try_float(_get_field_value(outcome.get("sample_size_intervention")))
        n_ctrl = _try_float(_get_field_value(outcome.get("sample_size_control")))

        if n_int is not None and n_ctrl is not None:
            combined = n_int + n_ctrl
            if total_n > 0 and abs(combined - total_n) / total_n > 0.05:
                warnings.append({
                    "field_path": f"outcomes[{i}].sample_size",
                    "severity": "warning",
                    "check_name": "sample_size_consistency",
                    "message": (
                        f"Intervention ({int(n_int)}) + Control ({int(n_ctrl)}) = {int(combined)}, "
                        f"but total sample size is {int(total_n)} "
                        f"(discrepancy: {abs(combined - total_n) / total_n:.0%})"
                    ),
                })

    return warnings


def _check_events_vs_sample_size(data: dict) -> list[dict]:
    """Check that events do not exceed sample sizes."""
    warnings = []
    outcomes = data.get("outcomes", [])
    if not isinstance(outcomes, list):
        return warnings

    for i, outcome in enumerate(outcomes):
        checks = [
            ("events_intervention", "sample_size_intervention", "intervention"),
            ("events_control", "sample_size_control", "control"),
        ]
        for events_key, n_key, group_name in checks:
            events = _try_float(_get_field_value(outcome.get(events_key)))
            n = _try_float(_get_field_value(outcome.get(n_key)))
            if events is not None and n is not None and events > n:
                warnings.append({
                    "field_path": f"outcomes[{i}].{events_key}",
                    "severity": "error",
                    "check_name": "events_exceed_sample_size",
                    "message": (
                        f"Events in {group_name} ({int(events)}) exceed "
                        f"sample size ({int(n)})"
                    ),
                })
            if events is not None and events < 0:
                warnings.append({
                    "field_path": f"outcomes[{i}].{events_key}",
                    "severity": "error",
                    "check_name": "negative_events",
                    "message": f"Negative event count ({events}) in {group_name}",
                })

    return warnings


def _check_ci_consistency(data: dict) -> list[dict]:
    """Check CI/p-value directional consistency."""
    warnings = []
    outcomes = data.get("outcomes", [])
    if not isinstance(outcomes, list):
        return warnings

    for i, outcome in enumerate(outcomes):
        ci_lower = _try_float(_get_field_value(outcome.get("ci_lower")))
        ci_upper = _try_float(_get_field_value(outcome.get("ci_upper")))

        # CI lower should be less than CI upper
        if ci_lower is not None and ci_upper is not None and ci_lower > ci_upper:
            warnings.append({
                "field_path": f"outcomes[{i}].ci_lower",
                "severity": "error",
                "check_name": "ci_bounds_inverted",
                "message": (
                    f"CI lower bound ({ci_lower}) is greater than "
                    f"upper bound ({ci_upper})"
                ),
            })

        # Check CI vs p-value directional agreement
        p_val_raw = _get_field_value(outcome.get("p_value"))
        p_val = _parse_p_value(p_val_raw)
        effect_measure = _get_field_value(outcome.get("effect_measure"))

        if ci_lower is not None and ci_upper is not None and p_val is not None:
            # For ratio measures (OR, RR, HR), null value is 1.0
            # For difference measures (MD, SMD), null value is 0.0
            null_value = 1.0 if effect_measure in ("OR", "RR", "HR") else 0.0
            ci_crosses_null = ci_lower <= null_value <= ci_upper
            p_nonsig = p_val > 0.05

            if ci_crosses_null and not p_nonsig:
                warnings.append({
                    "field_path": f"outcomes[{i}].p_value",
                    "severity": "warning",
                    "check_name": "ci_pvalue_disagreement",
                    "message": (
                        f"CI [{ci_lower}, {ci_upper}] crosses null ({null_value}) "
                        f"but p-value ({p_val}) suggests significance"
                    ),
                })
            elif not ci_crosses_null and p_nonsig:
                warnings.append({
                    "field_path": f"outcomes[{i}].p_value",
                    "severity": "warning",
                    "check_name": "ci_pvalue_disagreement",
                    "message": (
                        f"CI [{ci_lower}, {ci_upper}] does not cross null ({null_value}) "
                        f"but p-value ({p_val}) suggests non-significance"
                    ),
                })

    return warnings


def _check_effect_size_plausibility(data: dict) -> list[dict]:
    """Flag implausible effect sizes."""
    warnings = []
    outcomes = data.get("outcomes", [])
    if not isinstance(outcomes, list):
        return warnings

    for i, outcome in enumerate(outcomes):
        effect = _try_float(_get_field_value(outcome.get("effect_size")))
        measure = _get_field_value(outcome.get("effect_measure"))
        if effect is None or measure is None:
            continue

        if measure in ("OR", "RR", "HR"):
            if effect <= 0:
                warnings.append({
                    "field_path": f"outcomes[{i}].effect_size",
                    "severity": "error",
                    "check_name": "negative_ratio_measure",
                    "message": f"{measure} of {effect} is invalid (must be > 0)",
                })
            elif effect > 100:
                warnings.append({
                    "field_path": f"outcomes[{i}].effect_size",
                    "severity": "warning",
                    "check_name": "extreme_effect_size",
                    "message": f"{measure} of {effect} is extremely large — verify accuracy",
                })

        # Check for negative sample sizes
        for field in ("sample_size_intervention", "sample_size_control"):
            n = _try_float(_get_field_value(outcome.get(field)))
            if n is not None and n < 0:
                warnings.append({
                    "field_path": f"outcomes[{i}].{field}",
                    "severity": "error",
                    "check_name": "negative_sample_size",
                    "message": f"Negative sample size: {n}",
                })

    return warnings


def _parse_p_value(raw) -> float | None:
    """Parse a p-value from various string formats."""
    if raw is None:
        return None
    s = str(raw).strip().lower()
    s = s.replace("p", "").replace("=", "").replace("<", "").replace(">", "").strip()
    try:
        return float(s)
    except (ValueError, TypeError):
        return None
