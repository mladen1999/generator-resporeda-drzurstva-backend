import solver from "javascript-lp-solver";

export function solveRoster(input) {
  const people = input?.people ?? [];
  const days = input?.days ?? [];
  const shifts = input?.shifts ?? [];
  const availability = input?.availability ?? {};
  const C = input?.constraints ?? {};

  if (!people.length || !days.length || !shifts.length) {
    throw new Error("people/days/shifts ne smeju biti prazni.");
  }

  const maxPerPerson = Number(C.maxPerPerson ?? 3);
  const forbidConsecutiveDays = Boolean(C.forbidConsecutiveDays ?? true);
  const forbidTwoShiftsSameDay = Boolean(C.forbidTwoShiftsSameDay ?? true);

  const T = [];
  for (let d = 0; d < days.length; d++) {
    for (let s = 0; s < shifts.length; s++) {
      T.push({ d, s, key: `${days[d]} - ${shifts[s]}` });
    }
  }

  const totalSlots = days.length * shifts.length;
  const maxPossible = people.length * maxPerPerson;
  if (maxPossible < totalSlots) {
    return {
      feasible: false,
      message: `Nema rešenja: maksimalno ${maxPossible} smena moguće, a potrebno ${totalSlots}.`,
    };
  }

  for (let d = 0; d < days.length; d++) {
    for (let s = 0; s < shifts.length; s++) {
      let ok = false;
      for (const p of people) {
        if ((availability?.[p]?.[d]?.[s] ?? 0) === 1) {
          ok = true;
          break;
        }
      }
      if (!ok) {
        return {
          feasible: false,
          message: `Nema rešenja: niko nije dostupan za ${days[d]} - ${shifts[s]}.`,
        };
      }
    }
  }

  const model = {
    optimize: "obj",
    opType: "min",
    constraints: {},
    variables: {},
    ints: {},
  };

  model.variables["OBJ"] = { obj: 0 };

  const addBinVar = (name) => {
    if (!model.variables[name]) model.variables[name] = {};
    model.ints[name] = 1;
  };

  for (const t of T) {
    const cName = `slot_${t.d}_${t.s}`;
    model.constraints[cName] = { equal: 1 };

    for (const p of people) {
      const v = `x_${p}_${t.d}_${t.s}`;
      addBinVar(v);
      model.variables[v][cName] = 1;

      const av = availability?.[p]?.[t.d]?.[t.s] ?? 0;
      if (Number(av) === 0) {
        const aName = `avail_${p}_${t.d}_${t.s}`;
        model.constraints[aName] = { max: 0 };
        model.variables[v][aName] = 1;
      }
    }
  }

  for (const p of people) {
    const cName = `max_${p}`;
    model.constraints[cName] = { max: maxPerPerson };
    for (const t of T) {
      model.variables[`x_${p}_${t.d}_${t.s}`][cName] = 1;
    }
  }

  if (forbidTwoShiftsSameDay && shifts.length >= 2) {
    for (const p of people) {
      for (let d = 0; d < days.length; d++) {
        const cName = `oneDay_${p}_${d}`;
        model.constraints[cName] = { max: 1 };
        for (let s = 0; s < shifts.length; s++) {
          model.variables[`x_${p}_${d}_${s}`][cName] = 1;
        }
      }
    }
  }

  if (forbidConsecutiveDays && days.length >= 2) {
    for (const p of people) {
      for (let d = 0; d < days.length - 1; d++) {
        const cName = `consec_${p}_${d}`;
        model.constraints[cName] = { max: 1 };
        for (let s = 0; s < shifts.length; s++) {
          model.variables[`x_${p}_${d}_${s}`][cName] = 1;
          model.variables[`x_${p}_${d + 1}_${s}`][cName] = 1;
        }
      }
    }
  }

  const t0 = Date.now();
  const result = solver.Solve(model);
  const solveTimeMs = Date.now() - t0;

  if (!result.feasible) {
    return {
      feasible: false,
      message:
        "Nema rešenja uz data ograničenja. Povećaj maxPerPerson ili olabavi ograničenja.",
    };
  }

  const schedule = {};
  for (const t of T) {
    for (const p of people) {
      const v = `x_${p}_${t.d}_${t.s}`;
      if (Math.round(result[v] || 0) === 1) schedule[t.key] = p;
    }
  }

  const counts = {};
  for (const p of people) {
    let c = 0;
    for (const t of T) c += Math.round(result[`x_${p}_${t.d}_${t.s}`] || 0);
    counts[p] = c;
  }
  const vals = Object.values(counts);
  const maxAssignments = Math.max(...vals);
  const minAssignments = Math.min(...vals);
  const fairnessGap = maxAssignments - minAssignments;

  return {
    feasible: true,
    schedule,
    stats: {
      solveTimeMs,
      fairnessGap,
      maxAssignments,
      minAssignments,
      assignmentsPerPerson: counts,
    },
  };
}
