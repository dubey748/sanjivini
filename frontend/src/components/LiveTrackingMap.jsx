import React, { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker, Polyline } from "@react-google-maps/api";
import { Truck, Home } from "lucide-react";

const containerStyle = { width: "100%", height: "100%" };

// Default Mumbai coordinates for demo
const DEFAULT_DEST = { lat: 19.1136, lng: 72.8697 };  // Andheri E
const DEFAULT_START = { lat: 19.0760, lng: 72.8777 }; // Dadar

const lerp = (a, b, t) => a + (b - a) * t;

export default function LiveTrackingMap({ etaMinutes }) {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey || "",
  });

  const [pos, setPos] = useState(DEFAULT_START);
  const tRef = useRef(0);

  // Simulate rider movement toward destination
  useEffect(() => {
    if (!isLoaded) return;
    const totalSteps = 60;
    const i = setInterval(() => {
      tRef.current = Math.min(1, tRef.current + 1 / totalSteps);
      setPos({
        lat: lerp(DEFAULT_START.lat, DEFAULT_DEST.lat, tRef.current),
        lng: lerp(DEFAULT_START.lng, DEFAULT_DEST.lng, tRef.current),
      });
      if (tRef.current >= 1) clearInterval(i);
    }, 4000);
    return () => clearInterval(i);
  }, [isLoaded]);

  const onLoad = useCallback((map) => {
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(DEFAULT_START);
    bounds.extend(DEFAULT_DEST);
    map.fitBounds(bounds, 60);
  }, []);

  if (!apiKey) {
    return (
      <div className="relative h-64 w-full overflow-hidden rounded-t-3xl" data-testid="map-fallback">
        <img src="https://images.pexels.com/photos/6759307/pexels-photo-6759307.jpeg?auto=compress&w=1200" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 grid place-items-center bg-[#07231A]/40">
          <div className="rounded-2xl bg-white/95 px-4 py-2 text-center text-xs text-[#0F4C3A]">
            Set <code>REACT_APP_GOOGLE_MAPS_API_KEY</code> for live map
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return <div className="grid h-64 place-items-center bg-[#F0EFEB] text-sm text-[#C94A4A]" data-testid="map-error">Map failed to load. Check API key.</div>;
  }

  if (!isLoaded) {
    return <div className="grid h-64 animate-pulse place-items-center bg-[#F0EFEB] text-sm text-muted-foreground" data-testid="map-loading">Loading live map…</div>;
  }

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-t-3xl" data-testid="live-map">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={pos}
        zoom={13}
        onLoad={onLoad}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        }}
      >
        <Polyline
          path={[DEFAULT_START, DEFAULT_DEST]}
          options={{ strokeColor: "#0F4C3A", strokeOpacity: 0.4, strokeWeight: 4, geodesic: true }}
        />
        <Marker position={DEFAULT_DEST} label={{ text: "🏠", fontSize: "18px" }} title="Delivery address" />
        <Marker
          position={pos}
          title="Rider"
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#E26D5C",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 3,
          }}
        />
      </GoogleMap>
      <div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#0F4C3A]">
        <span className="live-dot" /> Live · ETA {etaMinutes} min
      </div>
    </div>
  );
}
