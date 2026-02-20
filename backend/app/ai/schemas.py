from pydantic import BaseModel


class SourceQuote(BaseModel):
    text: str
    page: int | None = None


class StudyDesignExtraction(BaseModel):
    type: str
    description: str
    quotes: list[str]


class PopulationExtraction(BaseModel):
    description: str
    inclusion_criteria: str | None = None
    exclusion_criteria: str | None = None
    sample_size: int | None = None
    quotes: list[str]


class InterventionExtraction(BaseModel):
    description: str
    dosage: str | None = None
    duration: str | None = None
    quotes: list[str]


class ComparatorExtraction(BaseModel):
    description: str
    quotes: list[str]


class OutcomeExtraction(BaseModel):
    name: str
    type: str  # primary or secondary
    measure: str | None = None
    effect_size: str | None = None
    effect_measure: str | None = None  # OR, RR, HR, MD, SMD
    ci_lower: float | None = None
    ci_upper: float | None = None
    p_value: str | None = None
    sample_size_intervention: int | None = None
    sample_size_control: int | None = None
    events_intervention: int | None = None
    events_control: int | None = None
    quotes: list[str]


class FullExtraction(BaseModel):
    study_design: StudyDesignExtraction
    population: PopulationExtraction
    intervention: InterventionExtraction
    comparator: ComparatorExtraction
    outcomes: list[OutcomeExtraction]
    setting: dict | None = None
    follow_up: dict | None = None
    funding: dict | None = None
    limitations: dict | None = None
    conclusions: dict | None = None


class GradeDomainRating(BaseModel):
    rating: str  # no_serious, serious, very_serious
    rationale: str
    quotes: list[str]


class GradeUpgradeFactor(BaseModel):
    applicable: bool
    rationale: str
    quotes: list[str] = []
