import { ReactNode } from "react";
import {
  AppShell as MantineAppShell,
  Group,
  NavLink,
  Title,
  Button,
  Divider,
} from "@mantine/core";
import {
  IconDashboard,
  IconFileText,
  IconBrain,
  IconSettings,
  IconLogout,
  IconFolderOpen,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const navItems = [
    { label: "Dashboard", icon: IconDashboard, path: "/" },
    { label: "Projects", icon: IconFolderOpen, path: "/projects" },
    { label: "Training Data", icon: IconBrain, path: "/training" },
    { label: "Settings", icon: IconSettings, path: "/settings" },
  ];

  return (
    <MantineAppShell
      navbar={{ width: 250, breakpoint: "sm" }}
      padding="md"
    >
      <MantineAppShell.Navbar p="md">
        <MantineAppShell.Section>
          <Group mb="md">
            <IconFileText size={28} />
            <Title order={4}>Data Extraction</Title>
          </Group>
          <Divider mb="sm" />
        </MantineAppShell.Section>

        <MantineAppShell.Section grow>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              label={item.label}
              leftSection={<item.icon size={18} />}
              active={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              mb={4}
            />
          ))}
        </MantineAppShell.Section>

        <MantineAppShell.Section>
          <Divider mb="sm" />
          <Group justify="space-between" px="sm">
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {user?.full_name}
              </div>
              <div style={{ fontSize: 12, color: "gray" }}>
                {user?.role}
              </div>
            </div>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={logout}
              leftSection={<IconLogout size={14} />}
            >
              Logout
            </Button>
          </Group>
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}
