// src/pages/AppShell.jsx
import {
  Box, Flex, Heading, IconButton, Spacer, Button, HStack, Text,
  useColorMode, useColorModeValue, Avatar, Menu, MenuButton, MenuItem, MenuList, MenuDivider, VStack
} from "@chakra-ui/react";
import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import { NavLink as RRLink } from "react-router-dom";
import { useAuth } from "../auth";

// Sidebar link with active highlighting + per-mode colors
const SidebarLink = ({ to, children }) => {
  // ✅ Light-mode refreshed, dark-mode unchanged
  const activeBg   = useColorModeValue("brand.100", "blue.900");   // was brand.200 (lighter, softer)
  const activeText = useColorModeValue("brand.700", "blue.200");   // was white (better contrast on light bg)
  const hoverBg    = useColorModeValue("gray.100", "gray.700");    // same for dark

  return (
    <Box as={RRLink} to={to} style={{ textDecoration: "none" }}>
      {({ isActive }) => (
        <Box
          px={3}
          py={2}
          rounded="md"
          fontSize="sm"
          bg={isActive ? activeBg : "transparent"}
          color={isActive ? activeText : "inherit"}
          _hover={{ bg: isActive ? activeBg : hoverBg }}
          transition="background 0.15s ease"
        >
          {children}
        </Box>
      )}
    </Box>
  );
};

export default function AppShell({ children }) {
  const { colorMode, toggleColorMode } = useColorMode();
  const { me, logout } = useAuth();

// ---- Light/Dark palette (LIGHT updated) ----
const headerBg   = useColorModeValue("white", "gray.800");
const headerText = useColorModeValue("gray.900", "gray.100");
const borderCol  = useColorModeValue("gray.400", "gray.700"); 

const sidebarBg  = useColorModeValue("white", "gray.850");
const mainBg     = useColorModeValue("gray.50", "gray.900");
const cardBg     = useColorModeValue("white", "gray.800");

const mutedText  = useColorModeValue("gray.500", "gray.400");


  return (
    <Flex minH="100vh" direction="column" bg={mainBg} color={headerText}>
      {/* Header */}
      <Flex
        as="header"
        px={6}
        py={3}
        borderBottom="1px"
        borderColor={borderCol}
        align="center"
        bg={headerBg}
      >
        <Heading size="md" color={headerText}>Planificator program si gestionare pentru centre de permanenta</Heading>
        <Spacer />
        {me && (
          <HStack spacing={3} mr={2}>
            <Text fontSize="sm" color={mutedText}>
              {me.first_name} • {me.global_role}
            </Text>
            <Menu>
              <MenuButton
                as={Avatar}
                size="sm"
                cursor="pointer"
                name={me.first_name}
                p={0}
                sx={{
                  ".chakra-avatar__initials": {
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                }}
              />
              <MenuList bg={cardBg} borderColor={borderCol}>
                <MenuItem as={RRLink} to="/profile">Profil</MenuItem>
                <MenuDivider />
                <MenuItem onClick={logout}>Deconectare</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        )}
        <IconButton
          aria-label="Toggle color mode"
          onClick={toggleColorMode}
          icon={colorMode === "light" ? <MoonIcon /> : <SunIcon />}
          variant="ghost"
        />
      </Flex>

      {/* Content: Sidebar + Main */}
      <Flex flex="1" minH={0}>
        {/* Sidebar */}
        <Box
          as="aside"
          w="240px"
          bg={sidebarBg}
          borderRight="1px"
          borderColor={borderCol}
          p={3}
        >
          <VStack align="stretch" spacing={1}>
            <SidebarLink to="/">Acasa</SidebarLink>
            <SidebarLink to="/my-calendar">Calendarul meu</SidebarLink>
            <SidebarLink to="/centers">Centre</SidebarLink>
            <SidebarLink to="/inbox">Inbox</SidebarLink>

            {me?.global_role === "admin" && (
              <>
                <Box pt={2} pb={1} px={1} fontSize="xs" color={mutedText} textTransform="uppercase">
                  Admin
                </Box>
                <SidebarLink to="/admin/centers">Gestionare Centre</SidebarLink>
                <SidebarLink to="/admin/users">Gestionare Utilizatori</SidebarLink>
                <SidebarLink to="/admin/requests">Cereri</SidebarLink>
                <SidebarLink to="/admin/support">Support</SidebarLink>
              </>
            )}
          </VStack>
        </Box>

        {/* Main */}
        <Box as="main" p={6} flex="1" minW={0} overflow="auto">
          <Box
            bg={cardBg}
            borderRadius="lg"
            p={5}
            shadow="sm"
            border="1px solid"
            borderColor={borderCol}
          >
            {children}
          </Box>
        </Box>
      </Flex>
    </Flex>
  );
}
