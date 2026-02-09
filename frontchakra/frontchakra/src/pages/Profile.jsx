// src/pages/Profile.jsx
import { useEffect, useState } from "react";
import {
  Box, Heading, FormControl, FormLabel, Input, Button, VStack, HStack,
  useToast, Divider, Text, useColorModeValue,
} from "@chakra-ui/react";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Profile() {
  const toast = useToast();
  const { me, refreshMe } = useAuth();  // use the hook directly

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState(""); // read-only here
  const [phone,     setPhone]     = useState("");

  const [curPw, setCurPw]   = useState("");
  const [newPw, setNewPw]   = useState("");
  const [confPw, setConfPw] = useState("");

  // ----- light/dark tokens -----
  const panelBg   = useColorModeValue("white", "gray.800");
  const borderCol = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.600", "gray.400");

  useEffect(() => {
    (async () => {
      try {
        // If me is missing phone (or me absent), fetch a fresh profile
        const u = (!me || me.phone == null) ? await api.me() : me;

        setFirstName(u.first_name || u.firstName || u.username || "");
        setLastName(u.last_name || u.lastName || "");
        setEmail(u.email || "");
        setPhone(String(u.phone ?? u.phone_number ?? ""));
      } catch (e) {
        toast({ status: "error", title: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [me, toast]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.profileUpdate({
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        phone:      phone.trim(),
      });
      toast({ status: "success", title: "Profile updated" });
      if (refreshMe) await refreshMe(); // refresh context so me.phone is up to date
    } catch (e) {
      toast({ status: "error", title: e.message });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!curPw || !newPw || !confPw) {
      return toast({ status: "warning", title: "Fill all password fields" });
    }
    setChangingPw(true);
    try {
      await api.profileChangePassword(curPw, newPw, confPw);
      toast({ status: "success", title: "Password changed" });
      setCurPw(""); setNewPw(""); setConfPw("");
    } catch (e) {
      toast({ status: "error", title: e.message });
    } finally {
      setChangingPw(false);
    }
  };

  if (loading) return <Text color={mutedText}>Loading profile…</Text>;

  return (
    <Box bg={panelBg} border="1px" borderColor={borderCol} rounded="md" p={6} maxW="640px">
      <Heading size="md" mb={4}>Profilul meu</Heading>

      <VStack align="stretch" spacing={4}>
        <HStack>
          <FormControl isRequired>
            <FormLabel>Prenume</FormLabel>
            <Input value={firstName} onChange={(e)=>setFirstName(e.target.value)} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Nume</FormLabel>
            <Input value={lastName} onChange={(e)=>setLastName(e.target.value)} />
          </FormControl>
        </HStack>

        <FormControl isReadOnly>
          <FormLabel>Email</FormLabel>
          <Input value={email} />
        </FormControl>

        <FormControl>
          <FormLabel>Telefon (optional)</FormLabel>
          <Input
            type="tel"
            value={phone}
            onChange={(e)=>setPhone(e.target.value)}
            placeholder="+40 7xx xxx xxx"
          />
          <Text mt={1} fontSize="sm" color={mutedText}>
            
          </Text>
        </FormControl>

        <HStack>
          <Button colorScheme="blue" onClick={saveProfile} isLoading={saving}>
            Salveaza
          </Button>
        </HStack>
      </VStack>

      <Divider my={6} borderColor={borderCol} />

      <Heading size="sm" mb={3}>Schimba parola</Heading>
      <VStack align="stretch" spacing={3}>
        <FormControl isRequired>
          <FormLabel>Parola curenta</FormLabel>
          <Input type="password" value={curPw} onChange={(e)=>setCurPw(e.target.value)} />
        </FormControl>
        <FormControl isRequired>
          <FormLabel>Parola noua</FormLabel>
          <Input type="password" value={newPw} onChange={(e)=>setNewPw(e.target.value)} minLength={6} />
        </FormControl>
        <FormControl isRequired>
          <FormLabel>Confirm noua parola</FormLabel>
          <Input type="password" value={confPw} onChange={(e)=>setConfPw(e.target.value)} minLength={6} />
        </FormControl>
        <HStack>
          <Button colorScheme="blue" onClick={changePassword} isLoading={changingPw}>
            Confirma schimbarea parolei
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}
