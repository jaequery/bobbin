"use client";

import { useEffect } from "react";
import { mount } from "../lib/jethro";

// Renders nothing itself: once the shell is in the DOM, the hash-driven
// renderer in lib/jethro.js takes over the sidebar, toolbar, view and lightbox.
export default function Jethro() {
  useEffect(() => mount(), []);
  return null;
}
