
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Clock3, Crown, ExternalLink, Radio,
  Settings2, ShieldCheck, Sparkles, Zap
} from "lucide-react";
import "./styles.css";

const ROBLOX_URL = "https://www.roblox.com/games/107778070777162/Steal-An-Egg";

// Carga automáticamente las imágenes de assets/pets/
const PET_IMAGE_FILES = import.meta.glob("../assets/pets/*", {
  eager: true,
  query: "?url",
  import: "default"
});

const PET_IMAGE_NAMES = {
  "Royal SkyWhale": "Royal SkyWhale.webp",
  "SkyWhale": "Royal SkyWhale.webp",
  "ArchAngel": "ArchAngel.webp",
  "WorldBurner": "WorldBurner.webp",
  "NightFlame": "NightFlame.webp",
  "Unicornio": "Unicorn.webp",
  "Unicorn": "Unicorn.webp",
  "Kitsune": "Kitsune.webp",
  "Celestial Sunlion": "Sun Lion.webp",
  "Gorilla King": "Gorilla King.webp",
  "Oni Tiger": "Oni Tiger.webp",
  "Pegasus": "Pegasus.webp"
};

function getPetImage(petName) {
  const filename = PET_IMAGE_NAMES[petName];
  if (!filename) return null;

  const image = Object.entries(PET_IMAGE_FILES).find(([path]) =>
    path.split("/").pop().toLowerCase() === filename.toLowerCase()
  );

  return image?.[1] || null;
}

const PETS = {
  "Oni Tiger": "ETERNAL",
  "Gorilla King": "ETERNAL",
  "Skeleton Horse": "ETERNAL",
  "Pegasus": "ETERNAL",
  "Celestial Sunlion": "ETERNAL",
  "Unicornio": "DIVINE",
  "Unicorn": "DIVINE",
  "Kitsune": "DIVINE",
  "NightFlame": "DIVINE",
  "WorldBurner": "DIVINE",
  "ArchAngel": "DIVINE",
  "SkyWhale": "DIVINE",
  "Royal SkyWhale": "DIVINE"
};

const BASE_BPS = {
  "Oni Tiger": 600_000_000,
  "Gorilla King": 880_000_000,
  "Skeleton Horse": 1_300_000_000,
  "Pegasus": 1_300_000_000,
  "Celestial Sunlion": 2_000_000_000,
  "Unicornio": 1_000_000_000,
  "Unicorn": 1_000_000_000,
  "Kitsune": 1_800_000_000,
  "NightFlame": 3_000_000_000,
  "WorldBurner": 5_000_000_000,
  "ArchAngel": 5_000_000_000,
  "SkyWhale": 8_000_000_000,
  "Royal SkyWhale": 8_000_000_000
};

function formatRate(value) {
  const units = ["", "K", "M", "B", "T", "Qa", "Qi"];

  if (!Number.isFinite(value) || value <= 0) {
    return "0.00/s";
  }

  const tier = Math.min(
    Math.floor(Math.log10(value) / 3),
    units.length - 1
  );

  const scaled = value / Math.pow(1000, tier);

  return `${scaled.toFixed(scaled >= 10 ? 1 : 2)}${units[tier]}/s`;
}

function getNextBoundary(now = new Date()) {
  const next = new Date(now);
  next.setSeconds(0, 0);

  const minute = now.getMinutes();
  next.setMinutes(minute - (minute % 5) + 5);

  return next;
}

function makeCards(event) {
  const multipliers = Array.from(
    { length: 10 },
    () => Math.random() * 10.23
  ).sort((a, b) => b - a);

  return multipliers.map((multiplier, index) => ({
    id: `${Date.now()}-${index}`,
    multiplier,
    rate: event.baseBps * multiplier
  }));
}

function App() {
  const [now, setNow] = useState(new Date());
  const [detection, setDetection] = useState(null);
  const [cards, setCards] = useState([]);
  const [cycleId, setCycleId] = useState("");
  const [connection, setConnection] = useState("waiting");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const boundary = getNextBoundary(now);

    const id = `${boundary.getFullYear()}-${boundary.getMonth()}-${boundary.getDate()}-${boundary.getHours()}-${boundary.getMinutes()}`;

    if (cycleId && id !== cycleId) {
      setDetection(null);
      setCards([]);
    }

    setCycleId(id);
  }, [now, cycleId]);

  useEffect(() => {
    if (!window.saeRadar?.onDetection) return;

    const unsubscribe = window.saeRadar.onDetection((event) => {
      const name = String(event.name || "").trim();

      if (!PETS[name] || detection) return;

      const nextDetection = {
        ...event,
        name,
        baseBps: BASE_BPS[name],
        rarity: PETS[name],
        detectedAt: new Date()
      };

      setDetection(nextDetection);
      setCards(makeCards(nextDetection));
      setConnection("connected");
    });

    return unsubscribe;
  }, [detection]);

  const nextBoundary = useMemo(() => getNextBoundary(now), [now]);

  const remaining = Math.max(
    0,
    Math.ceil((nextBoundary - now) / 1000)
  );

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  const progress = 100 - (remaining / 300) * 100;

  const petImage = detection ? getPetImage(detection.name) : null;

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar glass">
        <div className="brand">
          <div className="brand-mark">
            <Radio size={21} />
          </div>

          <div>
            <div className="brand-name">
              SAE <span>LIVE RADAR</span>
            </div>
            <div className="brand-sub">
              REAL-TIME SPAWN DETECTOR
            </div>
          </div>
        </div>

        <div className="top-actions">
          <div className={`connection ${connection === "connected" ? "is-live" : ""}`}>
            <i />
            {connection === "connected"
              ? "EVENTO RECIBIDO"
              : "ESPERANDO EVENTOS"}
          </div>

          <button
            className="icon-button"
            onClick={() => setShowSettings(v => !v)}
            title="Configuración"
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      <section className="hero-row">
        <div>
          <div className="eyebrow">
            <Sparkles size={14} /> LIVE MONITORING
          </div>

          <h1>
            El radar está <span>activo.</span>
          </h1>

          <p>
            Detectando Eternos y Divinos desde SAE PREDICTOR.
          </p>
        </div>

        <div className="clock-card glass">
          <div className="clock-label">
            <Clock3 size={14} /> PRÓXIMO RESET
          </div>

          <div className="clock">
            {minutes}:{seconds}
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="clock-foot">
            Ciclos cada 5 minutos · Hora local
          </div>
        </div>
      </section>

      {showSettings && (
        <section className="settings-panel glass">
          <div>
            <strong>Conexión local</strong>
            <small>
              API preparada para recibir eventos en
              127.0.0.1:4317/api/detection
            </small>
          </div>
        </section>
      )}

      {!detection ? (
        <section className="empty-state glass">
          <div className="radar-art">
            <div className="radar-ring ring-a" />
            <div className="radar-ring ring-b" />
            <div className="radar-ring ring-c" />
            <div className="radar-sweep" />

            <div className="radar-center">
              <Radio size={30} />
            </div>
          </div>

          <div className="empty-title">
            Nada por aquí
          </div>

          <p>
            No se detectaron Eternos ni Divinos en este ciclo.
          </p>

          <div className="empty-count">
            {minutes}:{seconds}
          </div>

          <div className="empty-caption">
            EL RADAR SE REINICIA AUTOMÁTICAMENTE
          </div>
        </section>
      ) : (
        <section className="results-section">
          <div className="results-heading">
            <div>
              <div className="eyebrow">
                <Zap size={14} /> SPAWN DETECTADO
              </div>

              <h2>{detection.name}</h2>

              <p>
                {detection.rarity} · Base {formatRate(detection.baseBps)}
              </p>
            </div>

            <div className="detected-pill">
              <span /> 10 CARTELES GENERADOS
            </div>
          </div>

          <div className="cards-grid">
            {cards.map((card, index) => (
              <article
                className={`spawn-card glass ${index === 0 ? "featured" : ""}`}
                key={card.id}
              >
                <div className="card-topline">
                  <span className="rank">
                    #{String(index + 1).padStart(2, "0")}
                  </span>

                  <span className={`rarity ${detection.rarity.toLowerCase()}`}>
                    {detection.rarity}
                  </span>
                </div>

                <div className="pet-art">
                  <div className="pet-orbit">
                    {petImage ? (
                      <img
                        src={petImage}
                        alt={detection.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          padding: "8px"
                        }}
                      />
                    ) : (
                      <Crown size={31} />
                    )}
                  </div>

                  <span>{detection.name}</span>
                </div>

                <div className="multiplier">
                  {card.multiplier.toFixed(2)}
                  <small>X</small>
                </div>

                <div className="rate">
                  {formatRate(card.rate)}
                </div>

                <button
                  className="join-button"
                  onClick={() => window.saeRadar?.openGame()}
                >
                  JOIN <ExternalLink size={15} />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="footer">
        <span>
          <ShieldCheck size={14} /> SAE PREDICTOR BRIDGE
        </span>

        <span>
          SAE LIVE RADAR <b>v0.1.0</b>
        </span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
