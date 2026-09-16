"use client";

import { useEffect, useState } from "react";
import { defaultProfile, loadPipeline, loadProfile } from "./storage";
import type { Lead, StudioProfile } from "./types";

export function useHydratedPipeline(): [Lead[], (next: Lead[]) => void, boolean] {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLeads(loadPipeline());
    setHydrated(true);
  }, []);

  return [leads, setLeads, hydrated];
}

export function useHydratedProfile(): [StudioProfile, (next: StudioProfile) => void] {
  const [profile, setProfile] = useState<StudioProfile>(defaultProfile);

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  return [profile, setProfile];
}
