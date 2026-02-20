import { useState } from "react";
import {
  Box,
  Button,
  Card,
  Center,
  Stack,
  TextInput,
  Title,
  Text,
  PasswordInput,
  Tabs,
  Alert,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { login, registerFirstUser, getMe } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<string | null>("login");
  const { setTokens, setUser } = useAuthStore();

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const tokens = await login(email, password);
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await getMe();
      setUser(user);
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError("");
    try {
      await registerFirstUser(email, password, fullName);
      // Auto-login after registration
      const tokens = await login(email, password);
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await getMe();
      setUser(user);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center h="100vh" bg="gray.0">
      <Card shadow="md" radius="md" w={400} p="xl">
        <Title order={2} ta="center" mb="md">
          Data Extraction Tool
        </Title>
        <Text size="sm" c="dimmed" ta="center" mb="lg">
          Scientific article data extraction with GRADE framework
        </Text>

        {error && (
          <Alert
            color="red"
            icon={<IconAlertCircle size={16} />}
            mb="md"
            variant="light"
          >
            {error}
          </Alert>
        )}

        <Tabs value={tab} onChange={setTab}>
          <Tabs.List grow mb="md">
            <Tabs.Tab value="login">Login</Tabs.Tab>
            <Tabs.Tab value="register">Register</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="login">
            <Stack>
              <TextInput
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
              />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />
              <Button onClick={handleLogin} loading={loading} fullWidth>
                Login
              </Button>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="register">
            <Stack>
              <Text size="xs" c="dimmed">
                Register the first admin user. This only works when no users
                exist.
              </Text>
              <TextInput
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.currentTarget.value)}
                required
              />
              <TextInput
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
              />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />
              <Button onClick={handleRegister} loading={loading} fullWidth>
                Register
              </Button>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Card>
    </Center>
  );
}
