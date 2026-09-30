"use client";

import { useEffect } from "react";
import { mount } from "../lib/bobbin";

// Renders nothing itself: once the shell is in the DOM, the hash-driven
// renderer in lib/bobbin.js takes over the sidebar, toolbar, view and lightbox.
export default function Bobbin() {
  useEffect(() => mount(), []);
  return null;
}
