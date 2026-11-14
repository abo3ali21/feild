"use client";

import React from "react";
import { LocateFixed, MapPin, Satellite } from "lucide-react";
import { useLang, Ltr } from "@/app/lang";
import { Demo } from "@/lib/types";

type FarmMapProps = {
  demo: Demo;
  locate: () => void;
  updateCoordinates: (c: Partial<Pick<Demo, "latitude" | "longitude">>) => void;
  displayName: string;
  displayCountry: string;
  displaySystem: string;
};

export function FarmMap({
  demo,
  locate,
  updateCoordinates,
  displayName,
  displayCountry,
  displaySystem,
}: FarmMapProps) {
  const { t } = useLang();

  return (
    <div className="farm-map-container" style={{ marginBottom: "1rem" }}>
      <div className="map-grid" aria-label={t.location.approximateAria}>
        <div className="map-copy">
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Satellite size={14} /> {t.location.region}
          </span>
          <strong>{displayName}</strong>
          <small>
            {displayCountry ? `${displayCountry} · ` : ""}
            {displaySystem}
          </small>
        </div>
        <MapPin className="map-pin" size={34} />
        <button className="locate" type="button" onClick={locate}>
          <LocateFixed size={16} /> {t.location.useLocation}
        </button>
        <span className="map-coordinate">
          <Ltr>
            {Math.abs(demo.latitude).toFixed(4)}°{demo.latitude >= 0 ? "N" : "S"},{" "}
            {Math.abs(demo.longitude).toFixed(4)}°{demo.longitude >= 0 ? "E" : "W"}
          </Ltr>
        </span>
      </div>

      <div className="coordinate-grid">
        <label>
          {t.location.latitude}
          <input
            type="number"
            min={-90}
            max={90}
            step="any"
            value={demo.latitude}
            onChange={(e) => updateCoordinates({ latitude: e.target.valueAsNumber })}
            inputMode="decimal"
          />
        </label>
        <label>
          {t.location.longitude}
          <input
            type="number"
            min={-180}
            max={180}
            step="any"
            value={demo.longitude}
            onChange={(e) => updateCoordinates({ longitude: e.target.valueAsNumber })}
            inputMode="decimal"
          />
        </label>
      </div>
    </div>
  );
}
