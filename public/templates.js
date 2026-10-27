/* Virtual Office — starter templates.
   A team's data is a flat map of "collection/id" → document:
     settings/team   { teamName, tagline, standupTz, standupTime, standupMinutes, workflowOn, floorW }
     roles/<id>      { name, color }                                   job titles
     rooms/<id>      { name, kind, color, x, y, w, h, task, desc, stage, flowOrder }
                     kind: desks | meeting | lounge | board | open
                     flowOrder: number when the room is a workflow stage, otherwise null
     members/<id>    { name, roleId, roomId, seat, city, country, tz, status, fun, ask, avatar, items:[{type,color}], createdAt }
     decor/<id>      { type, x, y, color }
   Shared by the browser (file mode) and server.js (creating new teams). */
(function (root) {
  const settings = (o) => ({ teamName: "New team", tagline: "", standupTz: "America/New_York", standupTime: "09:00", standupMinutes: 15, workflowOn: false, floorW: 1000, ...o });

  function sdlcRooms() {
    return {
      "rooms/room-plan": { name: "Scrum Master", kind: "desks", color: "#A78BFA", x: 20, y: 20, w: 180, h: 220, task: "Plan the sprint", desc: "Prioritises tickets for the sprint", stage: "Plan", flowOrder: 1 },
      "rooms/room-analyze": { name: "Business Analysts", kind: "desks", color: "#FBBF24", x: 240, y: 20, w: 180, h: 220, task: "Write requirements", desc: "Turns requests into clear requirements", stage: "Analyze", flowOrder: 2 },
      "rooms/room-build": { name: "Developers", kind: "desks", color: "#60A5FA", x: 460, y: 20, w: 520, h: 220, task: "Code, peer-review & merge", desc: "Build and peer-review the fix", stage: "Build", flowOrder: 3 },
      "rooms/room-test": { name: "QA Analysts", kind: "desks", color: "#22D3EE", x: 760, y: 286, w: 220, h: 220, task: "Test & log bugs", desc: "Test it; bugs go back to Build", stage: "Test", flowOrder: 4 },
      "rooms/room-release": { name: "QA Manager", kind: "desks", color: "#F472B6", x: 540, y: 286, w: 180, h: 220, task: "Sign off & release", desc: "Signs off quality and releases", stage: "Release", flowOrder: 5 },
      "rooms/room-board": { name: "Ticket board", kind: "board", color: "#7A86B8", x: 280, y: 286, w: 220, h: 220, task: "", desc: "", stage: "", flowOrder: null },
      "rooms/room-huddle": { name: "Huddle room", kind: "meeting", color: "#7A86B8", x: 20, y: 286, w: 220, h: 220, task: "", desc: "", stage: "", flowOrder: null },
    };
  }
  function sdlcRoles() {
    return {
      "roles/r-plan": { name: "Scrum Master", color: "#A78BFA" },
      "roles/r-analyze": { name: "Business Analyst", color: "#FBBF24" },
      "roles/r-build": { name: "Developer", color: "#60A5FA" },
      "roles/r-test": { name: "QA Analyst", color: "#22D3EE" },
      "roles/r-release": { name: "QA Manager", color: "#F472B6" },
    };
  }

  function clientRoom(kind, box) {
    const b = box || { x: 20, y: 546, w: 480, h: 250 };
    const sample = kind === "sample";
    return { "rooms/room-client": { name: "Our client", kind: "client", color: "#34D399", ...b, task: "", desc: "", stage: "", flowOrder: null,
      client: sample
        ? { name: "Client name", tagline: "Replace with your client's details and logo", logo: "", logoBg: "plate", images: [],
            fields: [{ label: "Industry", value: "Retail and e-commerce" }, { label: "What we support", value: "Customer web portal, mobile app, payments API" }, { label: "Working with them since", value: "2023" }, { label: "Main contact", value: "Add your client contact" }] }
        : { name: "", tagline: "", logo: "", logoBg: "plate", fields: [], images: [] } } };
  }

  const TEMPLATES = {
    blank: {
      label: "Blank office",
      hint: "A team room, meeting room, lounge and client room. Build it your way.",
      build: (name) => ({
        "settings/team": settings({ teamName: name, workflowOn: false }),
        "roles/r-member": { name: "Team member", color: "#60A5FA" },
        "roles/r-lead": { name: "Team lead", color: "#A78BFA" },
        "rooms/room-team": { name: "Team room", kind: "desks", color: "#22D3EE", x: 20, y: 20, w: 600, h: 260, task: "", desc: "", stage: "", flowOrder: null },
        "rooms/room-meet": { name: "Meeting room", kind: "meeting", color: "#7A86B8", x: 660, y: 20, w: 320, h: 260, task: "", desc: "", stage: "", flowOrder: null },
        "rooms/room-lounge": { name: "Lounge", kind: "lounge", color: "#34D399", x: 20, y: 320, w: 360, h: 200, task: "", desc: "", stage: "", flowOrder: null },
        ...clientRoom("", { x: 420, y: 320, w: 560, h: 220 }),
      }),
    },
    sdlc: {
      label: "Software delivery team",
      hint: "Rooms for the Scrum Master, analysts, developers, QA and release, plus a client room.",
      build: (name) => ({
        "settings/team": settings({ teamName: name, workflowOn: false, standupTime: "08:00" }),
        ...sdlcRoles(),
        ...sdlcRooms(),
        ...clientRoom(""),
      }),
    },
    sample: {
      label: "Sample team (11 people)",
      hint: "A filled-in example you can edit or clear out.",
      build: (name) => {
        const d = {
          "settings/team": settings({ teamName: name || "Software Development Support Team", tagline: "From ticket to release", workflowOn: false, standupTime: "08:00" }),
          ...sdlcRoles(),
          ...sdlcRooms(),
          ...clientRoom("sample"),
          "decor/d-plant1": { type: "bigplant", x: 206, y: 240, color: "" },
          "decor/d-plant2": { type: "bigplant", x: 728, y: 240, color: "" },
        };
        const people = [
          ["r-plan", "room-plan", "New York, NY", "United States", "America/New_York", [{ type: "keyboard", color: "#E11D48" }, { type: "mug", color: "#F8FAFC" }]],
          ["r-analyze", "room-analyze", "Austin, TX", "United States", "America/Chicago", [{ type: "books", color: "#2563EB" }]],
          ["r-build", "room-build", "Denver, CO", "United States", "America/Denver", [{ type: "cap", color: "#1D4ED8" }, { type: "baseball", color: "" }]],
          ["r-build", "room-build", "San Francisco, CA", "United States", "America/Los_Angeles", [{ type: "monitor", color: "#1E2340" }]],
          ["r-release", "room-release", "Bengaluru", "India", "Asia/Kolkata", [{ type: "trophy", color: "" }]],
          ["r-test", "room-test", "Mumbai", "India", "Asia/Kolkata", [{ type: "bear", color: "#B45309" }]],
          ["r-build", "room-build", "Pune", "India", "Asia/Kolkata", [{ type: "controller", color: "#7C3AED" }]],
          ["r-build", "room-build", "Hyderabad", "India", "Asia/Kolkata", [{ type: "headphones", color: "#0F172A" }]],
          ["r-test", "room-test", "Manila", "Philippines", "Asia/Manila", [{ type: "duck", color: "" }, { type: "mouse", color: "#E11D48" }]],
          ["r-build", "room-build", "Cebu", "Philippines", "Asia/Manila", [{ type: "basketball", color: "" }]],
          ["r-build", "room-build", "Davao", "Philippines", "Asia/Manila", [{ type: "succulent", color: "" }]],
        ];
        const seats = {};
        people.forEach(([roleId, roomId, city, country, tz, items], i) => {
          seats[roomId] = (seats[roomId] ?? -1) + 1;
          d["members/m-" + String(i + 1).padStart(2, "0")] = { name: "Member " + (i + 1), roleId, roomId, seat: seats[roomId], city, country, tz, status: "available", fun: "", ask: "", avatar: i, items, createdAt: 1000 + i };
        });
        return d;
      },
    },
  };

  /* Convert data saved by the first local edition (rooms = roles) into this format. */
  function migrateV1(old) {
    if (!old || typeof old !== "object" || Object.keys(old).some((k) => k.startsWith("rooms/"))) return old;
    const name = (old["settings/team"] && old["settings/team"].teamName) || "My team";
    const d = TEMPLATES.sdlc.build(name);
    Object.assign(d["settings/team"], old["settings/team"] || {}, { workflowOn: true, floorW: 1000 });
    const oldRoles = Object.entries(old).filter(([k]) => k.startsWith("roles/")).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
    const known = { "r-plan": "room-plan", "r-analyze": "room-analyze", "r-build": "room-build", "r-test": "room-test", "r-release": "room-release" };
    for (const k of Object.keys(d)) if (k.startsWith("roles/")) delete d[k];
    let extraX = 20;
    oldRoles.forEach(([k, r]) => {
      const id = k.split("/")[1];
      d["roles/" + id] = { name: r.name || "Role", color: r.color || "#60A5FA" };
      if (!known[id]) {
        const rid = "room-" + id;
        d["rooms/" + rid] = { name: r.plural || r.name || "Room", kind: "desks", color: r.color || "#60A5FA", x: extraX, y: 612, w: 220, h: 220, task: r.task || "", desc: r.desc || "", stage: r.stage || r.name || "", flowOrder: 6 + (extraX - 20) / 240 };
        known[id] = rid; extraX += 240;
      }
    });
    for (const id of ["r-plan", "r-analyze", "r-build", "r-test", "r-release"]) if (!old["roles/" + id]) { delete d["rooms/" + known[id]]; }
    const seats = {};
    Object.entries(old).filter(([k]) => k.startsWith("members/")).sort((a, b) => (a[1].createdAt ?? 0) - (b[1].createdAt ?? 0)).forEach(([k, m]) => {
      const roomId = known[m.roleId] && d["rooms/" + known[m.roleId]] ? known[m.roleId] : Object.keys(d).find((x) => x.startsWith("rooms/") && d[x].kind === "desks").split("/")[1];
      seats[roomId] = (seats[roomId] ?? -1) + 1;
      d[k] = { ...m, roomId, seat: seats[roomId], items: m.items || [] };
    });
    return d;
  }

  const api = { TEMPLATES, migrateV1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VO_TEMPLATES = api;
})(typeof window !== "undefined" ? window : globalThis);
