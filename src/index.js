import express from "express";
import cors from "cors";
import { solveRoster } from "./solver.js";

const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/example", (req, res) => {
  const days = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
  const shifts = ["Prepodne", "Popodne"];
  const people = ["Ana", "Marko", "Jelena", "Ivan", "Sara"];

  const availability = {};
  for (const p of people) {
    availability[p] = Array.from({ length: days.length }, () => [1, 1]);
  }
  availability["Ana"][0] = [1, 0];
  availability["Marko"][2] = [0, 1];
  availability["Jelena"][5] = [0, 1];
  availability["Ivan"][6] = [1, 0];

  res.json({
    people,
    days,
    shifts,
    availability,
    constraints: {
      maxPerPerson: 3,
      forbidConsecutiveDays: true,
      forbidTwoShiftsSameDay: true,
    },
  });
});
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});
app.post("/generate", (req, res) => {
  try {
    const out = solveRoster(req.body);
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

app.listen(8000, () => console.log("API running on http://127.0.0.1:8000"));
