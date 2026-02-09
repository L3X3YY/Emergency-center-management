import { useState } from "react";
import {
  Button, FormControl, FormLabel, Heading, Input, Stack, useToast,
  Tabs, TabList, TabPanels, Tab, TabPanel, Textarea, Text, Box, useColorModeValue
} from "@chakra-ui/react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useNavigate } from "react-router-dom";

export default function AuthPage() {
  const [reg, setReg] = useState({ first_name:"", last_name:"", email:"", password:"", passwordRecheck:"" });
  const [log, setLog] = useState({ email:"", password:"" });
  const [loading, setLoading] = useState(false);

  // support tab state
  const [supportEmail, setSupportEmail] = useState("");
  const [supportMsg, setSupportMsg] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);

  const toast = useToast();
  const { login } = useAuth();
  const nav = useNavigate();

  // light/dark aware panel styles for support card
  const panelBg   = useColorModeValue("white", "gray.800");
  const borderCol = useColorModeValue("gray.200", "gray.700");
  const muted     = useColorModeValue("gray.600", "gray.400");

  const doRegister = async (e) => {
    e.preventDefault();
    if (reg.password !== reg.passwordRecheck) {
      toast({ status:"error", title:"Parolele nu se potrivesc" }); return;
    }
    setLoading(true);
    try {
      await api.register(reg);
      toast({ status:"success", title:"Inregistrat. Asteapta aprobarea administratorului." });
    } catch (e2) {
      toast({ status:"error", title: e2.message || "Inregistrarea a esuat" });
    } finally { setLoading(false); }
  };

  const doLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(log.email, log.password);
      toast({ status:"success", title:"Conectat" });
      nav("/");
    } catch (e2) {
      toast({ status:"error", title: e2.message || "Conectare esuata" });
    } finally { setLoading(false); }
  };

  const sendSupport = async (e) => {
    e.preventDefault();
    const email = supportEmail.trim();
    const message = supportMsg.trim();
    if (!email || !message) {
      toast({ status:"warning", title:"Adaugati emailul pentru a putea trimite mesajul" });
      return;
    }
    setSendingSupport(true);
    try {
      await api.supportMessage({ email, message });
      setSupportEmail(""); setSupportMsg("");
      toast({ status:"success", title:"Mesajul a fostr timis" });
    } catch (err) {
      toast({ status:"error", title: err.message || "Mesajul nu a fost trimis" });
    } finally {
      setSendingSupport(false);
    }
  };

  return (
    <Tabs variant="enclosed" isFitted>
      <TabList>
        <Tab>Login</Tab>
        <Tab>Inregistrare</Tab>
        <Tab>Contact Admin</Tab>
      </TabList>

      <TabPanels>
        {/* LOGIN */}
        <TabPanel>
          <Stack as="form" spacing={4} onSubmit={doLogin}>
            <Heading size="md">Conectare</Heading>
            <FormControl isRequired>
              <FormLabel>Email</FormLabel>
              <Input type="email" value={log.email} onChange={e=>setLog({ ...log, email:e.target.value })}/>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Parola</FormLabel>
              <Input type="password" value={log.password} onChange={e=>setLog({ ...log, password:e.target.value })}/>
            </FormControl>
            <Button type="submit" colorScheme="blue" isLoading={loading}>Login</Button>
          </Stack>
        </TabPanel>

        {/* REGISTER */}
        <TabPanel>
          <Stack as="form" spacing={4} onSubmit={doRegister}>
            <Heading size="md">Creaza Cont</Heading>
            <FormControl isRequired>
              <FormLabel>Prenume</FormLabel>
              <Input value={reg.first_name} onChange={e=>setReg({ ...reg, first_name:e.target.value })}/>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Nume</FormLabel>
              <Input value={reg.last_name} onChange={e=>setReg({ ...reg, last_name:e.target.value })}/>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Email</FormLabel>
              <Input type="email" value={reg.email} onChange={e=>setReg({ ...reg, email:e.target.value })}/>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Parola</FormLabel>
              <Input type="password" value={reg.password} onChange={e=>setReg({ ...reg, password:e.target.value })}/>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Verificare parola</FormLabel>
              <Input type="password" value={reg.passwordRecheck} onChange={e=>setReg({ ...reg, passwordRecheck:e.target.value })}/>
            </FormControl>
            <Button type="submit" colorScheme="blue" isLoading={loading}>Register</Button>
          </Stack>
        </TabPanel>

        {/* CONTACT SUPPORT */}
        <TabPanel>
          <Box as="form" onSubmit={sendSupport} bg={panelBg} border="1px" borderColor={borderCol} rounded="md" p={4}>
            <Heading size="md" mb={1}>Aveti o problema ?</Heading>
            <Text color={muted} mb={4}>Contacteaza un admin:</Text>

            <FormControl isRequired mb={3}>
              <FormLabel>Email</FormLabel>
              <Input
                type="email"
                placeholder="email@example.com"
                value={supportEmail}
                onChange={(e)=>setSupportEmail(e.target.value)}
              />
            </FormControl>

            <FormControl isRequired mb={4}>
              <FormLabel>Mesaj</FormLabel>
              <Textarea
                placeholder="..."
                rows={5}
                value={supportMsg}
                onChange={(e)=>setSupportMsg(e.target.value)}
              />
            </FormControl>

            <Button type="submit" colorScheme="blue" isLoading={sendingSupport}>
              Trimite
            </Button>
          </Box>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
