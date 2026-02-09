// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider, extendTheme, ColorModeScript } from "@chakra-ui/react";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

const theme = extendTheme({
  config: { initialColorMode: "light", useSystemColorMode: false },
  fonts: {
    heading: "Inter, system-ui, sans-serif",
    body: "Inter, system-ui, sans-serif",
  },
  colors: {
    brand: {
      50:  "#ECEEDF", // very light background
      100: "#BBDCE5", // accent / highlight
      200: "#D9C4B0", // secondary
      300: "#CFAB8D", // tertiary
    },
  },
  styles: {
    global: (props) => ({
      body: {
        bg: props.colorMode === "light" ? "brand.50" : "gray.800",
        color: props.colorMode === "light" ? "gray.800" : "gray.100",
      },
    }),
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <ChakraProvider theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ChakraProvider>
  </React.StrictMode>
);
