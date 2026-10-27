/* Virtual Office — artwork: characters, desk items and floor decor, all drawn as SVG strings. */
(function (root) {
  const OL = "#1E2240";

  /* ---------- characters ---------- */
  const SKIN = ["#F6D2B8", "#E8B48E", "#C98B62", "#9C6644", "#F2C9A0", "#7A4E33"];
  const CAST = [
    [0, "#3B2A20", "short", "#6366F1", "#A5B4FC", "#2B3150", "headset"],
    [2, "#1E1B1B", "long", "#F5A524", "#FDE68A", "#3A3F5C", "glasses"],
    [1, "#7A3E1D", "spiky", "#3B82F6", "#93C5FD", "#26304A", ""],
    [4, "#E2B34A", "bob", "#EC4899", "#F9A8D4", "#2B3150", ""],
    [3, "#111111", "bun", "#A855F7", "#D8B4FE", "#3A3F5C", "glasses"],
    [2, "#2A1A12", "curly", "#17B890", "#86EFD0", "#2B3150", ""],
    [1, "#141414", "cap", "#F2545B", "#FCA5A5", "#26304A", ""],
    [5, "#0E0E0E", "short", "#0EA5E9", "#7DD3FC", "#3A3F5C", "headphones"],
    [0, "#B5562E", "long", "#84CC16", "#D9F99D", "#2B3150", ""],
    [3, "#1E1B1B", "spiky", "#F97316", "#FDBA74", "#26304A", "glasses"],
    [4, "#4A3426", "bun", "#14B8A6", "#99F6E4", "#3A3F5C", "headphones"],
    [1, "#2B2B2B", "curly", "#EAB308", "#FEF08A", "#26304A", "headset"],
    [5, "#141414", "bob", "#8B5CF6", "#C4B5FD", "#2B3150", ""],
    [0, "#C9A04B", "spiky", "#06B6D4", "#A5F3FC", "#3A3F5C", ""],
    [2, "#3B2A20", "cap", "#22C55E", "#BBF7D0", "#26304A", "glasses"],
    [4, "#111111", "long", "#E11D48", "#FDA4AF", "#2B3150", "headphones"],
  ];
  /* ---------- character builder ----------
     An avatar is either a preset number (0–15) or a spec object:
     { skin, hair, hairColor, beard, beardColor, eyes, head, headColor, outfit, outfitColor, accent, pants,
       backpack, pitchfork, lipstick, tired, extraArms } */
  const AVATAR_OPTIONS = {
    hair: { short: "Short", spiky: "Spiky", curly: "Curly", wavy: "Wavy, shoulder length", long: "Long", bob: "Bob", bun: "Bun", buzz: "Buzz cut", bald: "Bald" },
    beard: { none: "None", stubble: "Stubble", beard: "Beard", santa: "Big full beard" },
    eyes: { none: "None", glasses: "Glasses", sunglasses: "Sunglasses" },
    head: { none: "None", cap: "Baseball cap", strawhat: "Straw hat", beanie: "Beanie", bearbeanie: "Bear-ear beanie", headset: "Headset", headphones: "Headphones", helmet: "Motorcycle helmet" },
    outfit: { shirt: "Shirt", sweater: "Sweater", hoodie: "Hoodie", sport: "Sports jacket", robe: "Bathrobe", overalls: "Overalls" },
  };
  const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c || "");
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return "#" + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
  function presetSpec(i) {
    const [sk, hair, style, shirt, acc, pants, gear] = CAST[((i % CAST.length) + CAST.length) % CAST.length];
    return { skin: SKIN[sk], hair: style === "cap" ? "short" : style, hairColor: hair, beard: "none", beardColor: hair, eyes: gear === "glasses" ? "glasses" : "none",
      head: style === "cap" ? "cap" : gear === "headphones" || gear === "headset" ? gear : "none", headColor: style === "cap" ? shirt : acc,
      outfit: "shirt", outfitColor: shirt, accent: acc, pants, backpack: false, pitchfork: false, lipstick: false, tired: false, extraArms: false };
  }
  function normAvatar(av) {
    const base = presetSpec(0);
    if (typeof av === "number" || typeof av === "string") return presetSpec(+av || 0);
    if (!av || typeof av !== "object") return base;
    const o = { ...base };
    for (const k of ["skin", "hairColor", "beardColor", "headColor", "outfitColor", "accent", "pants"]) if (isHex(av[k])) o[k] = av[k];
    for (const k of ["hair", "beard", "eyes", "head", "outfit"]) if (AVATAR_OPTIONS[k][av[k]]) o[k] = av[k];
    for (const k of ["backpack", "pitchfork", "lipstick", "tired", "extraArms"]) o[k] = !!av[k];
    if (!isHex(av.beardColor)) o.beardColor = o.hairColor;
    return o;
  }
  function charSVG(av, delayKey = 0) {
    const a = normAvatar(av);
    const skin = a.skin, hair = a.hairColor, O = `stroke="${OL}" stroke-width="5"`;
    const R = (x, y, w, h, r, f, o = O) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}" ${o}/>`;
    const E = (cx, cy, rx, ry, f, o = O) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" ${o}/>`;
    const P = (d, f, o = O) => `<path d="${d}" fill="${f}" ${o}/>`;
    const capTop = (x0, y0, x1, y1, f, o = O) => { const rx = (x1 - x0) / 2, ry = (y1 - y0) / 2, cy = y0 + ry; return `<path d="M${x0},${cy} A${rx},${ry} 0 0 1 ${x1},${cy} Z" fill="${f}" ${o}/>`; };
    const top = a.outfit === "overalls" ? "#C2410C" : a.outfitColor;
    const pants = a.outfit === "overalls" ? "#3B6EA5" : a.pants;

    /* behind the body */
    let back = "";
    if (a.hair === "long") back += R(54, 70, 172, 166, 60, hair);
    if (a.hair === "wavy") back += P("M56 86 C40 130 66 150 50 190 C64 214 96 206 104 194 L176 194 C184 206 216 214 230 190 C214 150 240 130 224 86 Z", hair);
    if (a.backpack) back += R(58, 176, 32, 84, 12, "#475569") + R(190, 176, 32, 84, 12, "#475569");
    if (a.outfit === "hoodie") back += E(140, 192, 74, 26, shade(top, 0.85));
    if (a.extraArms) {
      const sl = a.outfit === "robe" ? a.outfitColor : top;
      const arm = (side, deg) => { const px = side < 0 ? 96 : 184; return `<g transform="rotate(${-side * deg} ${px} 206)">${R(px - 15, 200, 30, 92, 15, sl)}${E(px, 292, 15, 15, skin)}</g>`; };
      back += arm(1, 70) + arm(-1, 70) + arm(1, 128) + arm(-1, 128);
    }

    /* legs, arms, body */
    let body = R(108, 258, 26, 48, 10, pants) + R(146, 258, 26, 48, 10, pants) + E(117, 305, 21, 13, "#2B2B3A") + E(163, 305, 21, 13, "#2B2B3A");
    const sleeve = a.outfit === "robe" ? a.outfitColor : top;
    body += a.outfit === "robe" ? R(54, 194, 40, 70, 18, sleeve) + R(186, 194, 40, 70, 18, sleeve) : R(60, 196, 32, 66, 16, sleeve) + R(188, 196, 32, 66, 16, sleeve);
    body += E(76, 260, 14, 14, skin) + E(204, 260, 14, 14, skin);
    body += R(80, 186, 120, 88, 30, a.outfit === "robe" ? a.outfitColor : top);
    if (a.outfit === "shirt") body += `<path d="M118 190h44l-22 26z" fill="${a.accent}"/>` + R(126, 230, 28, 20, 6, a.accent, "");
    if (a.outfit === "sweater") body += `<path d="M112 190 Q140 214 168 190" fill="none" stroke="${shade(top, 0.75)}" stroke-width="7"/>` + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => `<path d="M${90 + k * 9} 258v12" stroke="${shade(top, 0.75)}" stroke-width="3"/>`).join("") + `<path d="M120 222 l20 10 l20 -10" fill="none" stroke="${a.accent}" stroke-width="4"/>`;
    if (a.outfit === "hoodie") body += `<path d="M128 198 v28 M152 198 v28" stroke="#F8FAFC" stroke-width="4" stroke-linecap="round"/>` + R(104, 238, 72, 26, 8, shade(top, 0.88), `stroke="${OL}" stroke-width="3"`);
    if (a.outfit === "sport") body += `<path d="M140 190 V272" stroke="#E5E7EB" stroke-width="4"/>` + `<path d="M118 188 h44 v10 h-44 z" fill="${shade(top, 0.8)}"/>` + `<path d="M70 200 v56 M210 200 v56" stroke="#F8FAFC" stroke-width="4"/>` + `<path d="M86 236 h28 M166 236 h28" stroke="#F8FAFC" stroke-width="4"/>`;
    if (a.outfit === "robe") body += `<path d="M118 188 h44 l-22 34 z" fill="${skin}"/>` + `<path d="M104 188 L140 252 L122 188 Z M176 188 L140 252 L158 188 Z" fill="#FFFFFF" opacity=".45"/>` + R(80, 234, 120, 14, 6, shade(a.outfitColor, 0.78), "") + `<path d="M150 246 l10 22 M156 246 l-2 24" stroke="${shade(a.outfitColor, 0.7)}" stroke-width="6" stroke-linecap="round"/>` + [[96, 214], [184, 214], [100, 262], [178, 262], [66, 220], [214, 220]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#fff" opacity=".5"/>`).join("");
    if (a.outfit === "overalls") body += [0, 1, 2, 3].map((k) => `<path d="M${84 + k * 32} 190 V272" stroke="#7F1D1D" stroke-width="3" opacity=".55"/>`).join("") + `<path d="M84 220 H196 M84 250 H196" stroke="#7F1D1D" stroke-width="3" opacity=".55"/>` + R(104, 216, 72, 58, 8, "#3B6EA5") + `<path d="M108 218 L98 188 M172 218 L182 188" stroke="#3B6EA5" stroke-width="12" stroke-linecap="round"/>` + `<circle cx="114" cy="226" r="5" fill="#FACC15"/><circle cx="166" cy="226" r="5" fill="#FACC15"/>` + R(124, 236, 32, 18, 4, shade("#3B6EA5", 0.85), "");
    if (a.backpack) body += `<path d="M100 188 L102 266 M180 188 L178 266" stroke="#1E293B" stroke-width="11" stroke-linecap="round"/><path d="M100 236 H180" stroke="#1E293B" stroke-width="6"/>`;

    /* head */
    let head = E(62, 115, 14, 15, skin) + E(218, 115, 14, 15, skin) + E(140, 110, 82, 82, skin);
    const beardPath = "M66 116 Q66 206 140 214 Q214 206 214 116 Q200 172 140 174 Q80 172 66 116 Z";
    if (a.beard === "stubble") head += P(beardPath, a.beardColor, `opacity=".28"`);
    if (a.beard === "beard") head += P(beardPath, a.beardColor);
    if (a.beard === "santa") head += P("M62 112 Q52 256 140 270 Q228 256 218 112 Q204 176 140 178 Q76 176 62 112 Z", a.beardColor) + [86, 112, 140, 168, 194].map((x, k) => `<circle cx="${x}" cy="${248 + (k % 2) * 10}" r="16" fill="${a.beardColor}"/>`).join("");

    /* hair */
    let hairF = "";
    const cap = (f) => capTop(52, 18, 228, 150, f) + `<path d="M58 86h164l-12-22H70z" fill="${f}"/>`;
    if (["short", "spiky", "curly", "long", "bob", "bun", "wavy"].includes(a.hair)) hairF += cap(hair);
    if (a.hair === "short") hairF += `<path d="M70 84h50l-24 22z" fill="${hair}"/>`;
    if (a.hair === "spiky") hairF = [64, 96, 128, 160, 192].map((x) => `<path d="M${x} 42h28l-18-40z" fill="${hair}" ${O}/>`).join("") + hairF + `<path d="M150 84h64l-8 24z" fill="${hair}"/>`;
    if (a.hair === "curly") hairF += [[60, 50], [92, 26], [130, 18], [168, 26], [200, 50], [58, 84], [204, 84]].map(([x, y]) => E(x, y, 22, 22, hair)).join("");
    if (a.hair === "long") hairF += `<path d="M60 86h90l-80 34z" fill="${hair}"/>`;
    if (a.hair === "wavy") hairF += `<path d="M60 86 C90 110 120 70 150 92 C170 104 200 84 222 98 L222 86 Z" fill="${hair}"/>` + R(52, 70, 26, 96, 13, hair) + R(202, 70, 26, 96, 13, hair);
    if (a.hair === "bob") hairF = R(50, 60, 34, 108, 16, hair) + R(196, 60, 34, 108, 16, hair) + hairF;
    if (a.hair === "bun") hairF = E(140, 14, 28, 26, hair) + hairF + `<path d="M64 86h76l-58 18z" fill="${hair}"/>`;
    if (a.hair === "buzz") hairF += capTop(56, 26, 224, 140, hair, `opacity=".55"`);
    if (a.hair === "bald") hairF += `<path d="M108 52 Q124 40 146 42" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".5"/>`;

    /* headwear */
    let hat = "";
    const hc = a.headColor;
    if (a.head === "cap") hat += R(56, 78, 30, 42, 8, a.hair === "bald" ? skin : hair) + R(194, 78, 30, 42, 8, a.hair === "bald" ? skin : hair) + capTop(56, 18, 224, 146, hc) + R(120, 62, 116, 22, 10, hc) + E(140, 22, 8, 8, shade(hc, 0.75));
    if (a.head === "beanie" || a.head === "bearbeanie") {
      if (a.head === "bearbeanie") hat += E(72, 34, 24, 24, hc) + E(72, 34, 11, 11, shade(hc, 1.25), "") + E(208, 34, 24, 24, hc) + E(208, 34, 11, 11, shade(hc, 1.25), "");
      hat += capTop(54, 8, 226, 150, hc) + R(52, 66, 176, 26, 12, shade(hc, 0.82));
      if (a.head === "beanie") hat += E(140, 4, 16, 16, shade(hc, 1.2));
    }
    if (a.head === "helmet") hat += R(40, 84, 32, 60, 14, shade(hc, 0.85)) + R(208, 84, 32, 60, 14, shade(hc, 0.85)) + capTop(42, 0, 238, 156, hc) + R(42, 66, 196, 24, 11, shade(hc, 0.8)) + `<path d="M84 22 Q140 2 196 22" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".55"/>` + `<path d="M58 144 Q70 196 116 204 M222 144 Q210 196 164 204" fill="none" stroke="#1F2937" stroke-width="5"/>`;
    if (a.head === "strawhat") hat += P("M88 44 Q90 -6 140 -6 Q190 -6 192 44 Z", "#E9C46A") + `<path d="M90 34 H190" stroke="#B91C1C" stroke-width="9"/>` + E(140, 48, 128, 20, "#F2D27A");

    /* face */
    let face = `<g class="eyes"><ellipse cx="113" cy="129" rx="9" ry="13" fill="#1E2033"/><ellipse cx="167" cy="129" rx="9" ry="13" fill="#1E2033"/><circle cx="116" cy="124" r="3.5" fill="#fff"/><circle cx="170" cy="124" r="3.5" fill="#fff"/></g>`;
    if (a.tired) face += `<path d="M101 148 Q113 155 125 148 M155 148 Q167 155 179 148" fill="none" stroke="#A86F6F" stroke-width="3" stroke-linecap="round"/>`;
    face += `<ellipse cx="96" cy="153" rx="12" ry="7" fill="#F4A3A3"/><ellipse cx="184" cy="153" rx="12" ry="7" fill="#F4A3A3"/>`;
    face += a.lipstick ? `<path d="M127 156 Q140 172 153 156 Q140 162 127 156 Z" fill="#E05A6A" stroke="#B83246" stroke-width="2.5"/>` : `<path d="M128 156 Q140 168 152 156" fill="none" stroke="#1E2033" stroke-width="4.5" stroke-linecap="round"/>`;
    if (a.beard === "beard" || a.beard === "santa") face += P("M108 154 Q124 140 140 150 Q156 140 172 154 Q156 162 140 156 Q124 162 108 154 Z", a.beardColor, `stroke="${OL}" stroke-width="3"`);

    /* eyewear and audio gear */
    let gear = "";
    if (a.eyes === "glasses") gear += `<g fill="none" stroke="#1E2033" stroke-width="5"><circle cx="113" cy="128" r="17"/><circle cx="167" cy="128" r="17"/><path d="M130 126h20"/></g>`;
    if (a.eyes === "sunglasses") gear += `<rect x="92" y="114" width="42" height="28" rx="11" fill="#111827" stroke="${OL}" stroke-width="3"/><rect x="146" y="114" width="42" height="28" rx="11" fill="#111827" stroke="${OL}" stroke-width="3"/><path d="M134 124 h12" stroke="#111827" stroke-width="5"/><path d="M100 122 l10 -4 M154 122 l10 -4" stroke="#94A3B8" stroke-width="3" stroke-linecap="round"/>`;
    if (a.head === "headphones" || a.head === "headset") {
      gear += `<path d="M50 104 A90 88 0 0 1 230 104" fill="none" stroke="#2B2B3A" stroke-width="13"/>` + R(38, 92, 28, 48, 10, "#2B2B3A") + R(214, 92, 28, 48, 10, "#2B2B3A") + R(44, 100, 16, 32, 6, hc, "") + R(220, 100, 16, 32, 6, hc, "");
      if (a.head === "headset") gear += `<path d="M52 136 Q62 166 108 168" fill="none" stroke="#2B2B3A" stroke-width="6"/><circle cx="108" cy="168" r="8" fill="#2B2B3A"/>`;
    }

    /* props held in the right hand */
    let prop = "";
    if (a.pitchfork) prop += `<path d="M206 274 L246 34" stroke="#8B5A2B" stroke-width="8" stroke-linecap="round"/><path d="M226 40 L264 46 M228 40 L234 4 M245 43 L251 7 M262 46 L268 10" stroke="#94A3B8" stroke-width="6" stroke-linecap="round" fill="none"/>` + E(204, 260, 14, 14, skin);

    return `<svg class="ch" viewBox="-6 -10 292 360" style="--d:${(-(delayKey % 7) * 0.37).toFixed(2)}s" aria-hidden="true"><g class="bob">${back}${body}${head}${hairF}${hat}${face}${gear}${prop}</g></svg>`;
  }

  /* ---------- desk items (40×40 drawings) ---------- */
  const s = `stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"`;
  const ITEMS = {
    keyboard: { label: "Keyboard", def: "#334155", draw: (c) => `<rect x="2" y="17" width="36" height="14" rx="3" fill="${c}" ${s}/>${[5, 10, 15, 20, 25, 30].map((x) => `<rect x="${x}" y="20" width="3.5" height="3" rx=".8" fill="#fff" opacity=".55"/><rect x="${x}" y="25" width="3.5" height="3" rx=".8" fill="#fff" opacity=".55"/>`).join("")}` },
    mouse: { label: "Mouse", def: "#334155", draw: (c) => `<path d="M20 6 Q20 2 26 2" fill="none" stroke="${OL}" stroke-width="1.6"/><ellipse cx="20" cy="22" rx="9" ry="13" fill="${c}" ${s}/><path d="M20 10v9" stroke="${OL}" stroke-width="1.6"/>` },
    monitor: { label: "Second monitor", def: "#1E2340", draw: (c) => `<rect x="3" y="4" width="34" height="23" rx="2.5" fill="${c}" ${s}/><rect x="6" y="7" width="28" height="17" fill="#7DD3FC"/><path d="M8 11h14M8 15h18M8 19h10" stroke="#1E3A8A" stroke-width="1.6" opacity=".6"/><rect x="17" y="27" width="6" height="6" fill="#475569"/><rect x="11" y="33" width="18" height="3" rx="1.5" fill="#475569" ${s}/>` },
    laptop: { label: "Laptop", def: "#94A3B8", draw: (c) => `<rect x="7" y="7" width="26" height="19" rx="2" fill="#1E2340" ${s}/><rect x="9.5" y="9.5" width="21" height="14" fill="#A5F3FC"/><path d="M3 31 L7 26 H33 L37 31 Z" fill="${c}" ${s}/>` },
    mug: { label: "Mug", def: "#F8FAFC", draw: (c) => `<path d="M14 6 q-2 3 0 6 M20 4 q-2 3 0 6" fill="none" stroke="#94A3B8" stroke-width="1.5"/><path d="M26 18 h3 a5 5 0 0 1 0 10 h-3" fill="none" stroke="${OL}" stroke-width="2.4"/><rect x="9" y="14" width="18" height="21" rx="3" fill="${c}" ${s}/><rect x="9" y="14" width="18" height="4" fill="#6B3E1E" opacity=".75"/>` },
    bear: { label: "Plushie bear", def: "#B45309", draw: (c) => `<circle cx="11" cy="9" r="5" fill="${c}" ${s}/><circle cx="29" cy="9" r="5" fill="${c}" ${s}/><ellipse cx="20" cy="31" rx="10" ry="8" fill="${c}" ${s}/><circle cx="20" cy="17" r="10" fill="${c}" ${s}/><ellipse cx="20" cy="21" rx="5" ry="3.6" fill="#FDE7C8"/><circle cx="16" cy="15" r="1.5" fill="${OL}"/><circle cx="24" cy="15" r="1.5" fill="${OL}"/><circle cx="20" cy="20" r="1.3" fill="${OL}"/>` },
    cat: { label: "Plushie cat", def: "#F5F5F4", draw: (c) => `<path d="M10 14 L11 3 L18 9 Z M30 14 L29 3 L22 9 Z" fill="${c}" ${s}/><ellipse cx="20" cy="31" rx="10" ry="8" fill="${c}" ${s}/><circle cx="20" cy="17" r="10" fill="${c}" ${s}/><circle cx="16" cy="16" r="1.5" fill="${OL}"/><circle cx="24" cy="16" r="1.5" fill="${OL}"/><path d="M18 20 l2 1.5 l2-1.5" fill="none" stroke="#F472B6" stroke-width="1.5"/><path d="M8 19h6M26 19h6" stroke="#94A3B8" stroke-width="1"/>` },
    cap: { label: "Baseball cap", def: "#1D4ED8", draw: (c) => `<path d="M6 27 A14 13 0 0 1 32 27 Z" fill="${c}" ${s}/><path d="M24 27 H38 a2 2 0 0 1 0 4 H22 Z" fill="${c}" ${s}/><circle cx="19" cy="14" r="1.8" fill="#fff" ${s}/><path d="M19 15 V27" stroke="#fff" stroke-width="1.2" opacity=".6"/>` },
    baseball: { label: "Baseball", def: "", draw: () => `<circle cx="20" cy="22" r="12" fill="#FAFAF9" ${s}/><path d="M11 13 Q16 22 11 31 M29 13 Q24 22 29 31" fill="none" stroke="#DC2626" stroke-width="1.6" stroke-dasharray="2 1.6"/>` },
    basketball: { label: "Basketball", def: "", draw: () => `<circle cx="20" cy="22" r="12" fill="#F97316" ${s}/><path d="M8 22h24M20 10v24M11 14 Q20 22 11 30M29 14 Q20 22 29 30" fill="none" stroke="${OL}" stroke-width="1.3"/>` },
    soccer: { label: "Soccer ball", def: "", draw: () => `<circle cx="20" cy="22" r="12" fill="#fff" ${s}/><path d="M20 17 l4.8 3.5 -1.8 5.6 h-6 l-1.8-5.6 z" fill="${OL}"/><path d="M20 17v-7M24.8 20.5l6.5-2M23 26l4 5.5M17 26l-4 5.5M15.2 20.5l-6.5-2" stroke="${OL}" stroke-width="1.3"/>` },
    succulent: { label: "Succulent", def: "#C2410C", draw: (c) => `<path d="M20 22 C10 18 8 8 12 6 C16 12 18 14 20 22 Z" fill="#4ADE80" ${s}/><path d="M20 22 C30 18 32 8 28 6 C24 12 22 14 20 22 Z" fill="#22C55E" ${s}/><path d="M20 22 C18 12 20 4 20 4 C22 10 22 14 20 22 Z" fill="#86EFAC" ${s}/><path d="M11 22 H29 L26 36 H14 Z" fill="${c}" ${s}/>` },
    books: { label: "Books", def: "#2563EB", draw: (c) => `<rect x="5" y="27" width="30" height="7" rx="1" fill="${c}" ${s}/><rect x="7" y="20" width="27" height="7" rx="1" fill="#F59E0B" ${s}/><rect x="4" y="13" width="29" height="7" rx="1" fill="#10B981" ${s}/><path d="M8 16.5h10M10 23.5h12M9 30.5h14" stroke="#fff" stroke-width="1" opacity=".6"/>` },
    lamp: { label: "Desk lamp", def: "#FACC15", draw: (c) => `<path d="M22 12 L30 8 L36 18 L26 20 Z" fill="${c}" ${s}/><path d="M12 34 L18 20 L27 14" fill="none" stroke="${OL}" stroke-width="2.4"/><ellipse cx="13" cy="35" rx="8" ry="3" fill="#475569" ${s}/><path d="M31 20 l3 6" stroke="#FDE68A" stroke-width="2" opacity=".8"/>` },
    headphones: { label: "Headphones", def: "#0F172A", draw: (c) => `<path d="M8 26 V20 A12 12 0 0 1 32 20 V26" fill="none" stroke="${c}" stroke-width="4"/><rect x="4" y="22" width="8" height="12" rx="3" fill="${c}" ${s}/><rect x="28" y="22" width="8" height="12" rx="3" fill="${c}" ${s}/>` },
    controller: { label: "Game controller", def: "#7C3AED", draw: (c) => `<path d="M10 14 H30 C36 14 38 30 33 32 C29 34 27 27 24 27 H16 C13 27 11 34 7 32 C2 30 4 14 10 14 Z" fill="${c}" ${s}/><path d="M11 19v6M8 22h6" stroke="#fff" stroke-width="2"/><circle cx="28" cy="20" r="1.8" fill="#FACC15"/><circle cx="31" cy="23" r="1.8" fill="#F87171"/>` },
    duck: { label: "Rubber duck", def: "#FACC15", draw: (c) => `<ellipse cx="19" cy="28" rx="13" ry="8" fill="${c}" ${s}/><circle cx="24" cy="15" r="7" fill="${c}" ${s}/><path d="M30 15 L37 17 L30 19 Z" fill="#F97316" ${s}/><circle cx="25" cy="13" r="1.4" fill="${OL}"/><path d="M10 26 q6 4 12 0" fill="none" stroke="${OL}" stroke-width="1.2" opacity=".5"/>` },
    trophy: { label: "Trophy", def: "#F59E0B", draw: (c) => `<path d="M12 5 H28 V14 A8 8 0 0 1 12 14 Z" fill="${c}" ${s}/><path d="M12 8 H7 a4 4 0 0 0 5 8 M28 8 H33 a4 4 0 0 1 -5 8" fill="none" stroke="${OL}" stroke-width="1.6"/><rect x="18" y="22" width="4" height="7" fill="${c}" ${s}/><rect x="12" y="29" width="16" height="6" rx="1" fill="#78350F" ${s}/>` },
    frame: { label: "Photo frame", def: "#92400E", draw: (c) => `<rect x="7" y="6" width="26" height="28" rx="2" fill="${c}" ${s}/><rect x="10.5" y="9.5" width="19" height="21" fill="#BAE6FD"/><path d="M10.5 30.5 L17 21 L21 26 L24 22 L29.5 30.5 Z" fill="#16A34A"/><circle cx="25" cy="14" r="2.5" fill="#FDE047"/>` },
    cube: { label: "Puzzle cube", def: "", draw: () => { const cs = ["#EF4444", "#22C55E", "#3B82F6", "#FACC15", "#F97316", "#fff", "#22C55E", "#EF4444", "#3B82F6"]; return `<rect x="7" y="9" width="26" height="26" rx="3" fill="${OL}"/>` + cs.map((c, i) => `<rect x="${9 + (i % 3) * 8}" y="${11 + Math.floor(i / 3) * 8}" width="6.5" height="6.5" rx="1" fill="${c}"/>`).join(""); } },
    notebook: { label: "Notebook and pen", def: "#F59E0B", draw: (c) => `<rect x="8" y="5" width="24" height="31" rx="2" fill="${c}" ${s}/><path d="M12 12h16M12 17h16M12 22h12M12 27h14" stroke="#fff" stroke-width="1.6" opacity=".75"/>${[9, 15, 21, 27, 33].map((y) => `<circle cx="8" cy="${y - 2}" r="1.6" fill="#fff" stroke="${OL}" stroke-width="1"/>`).join("")}<path d="M24 37 L37 14 L39.5 15.5 L26.5 38.5 Z" fill="#334155" ${s}/>` },
    phone: { label: "Phone", def: "#111827", draw: (c) => `<rect x="12" y="4" width="17" height="32" rx="3.5" fill="${c}" ${s}/><rect x="14.5" y="8" width="12" height="22" rx="1" fill="#60A5FA"/><path d="M17 14h7M17 18h5M17 22h7" stroke="#fff" stroke-width="1.4" opacity=".8"/><circle cx="20.5" cy="33" r="1.2" fill="#94A3B8"/>` },
    earbuds: { label: "Earbuds", def: "#F8FAFC", draw: (c) => `<path d="M10 14 a6 6 0 1 1 6 6 v12 a2.5 2.5 0 0 1 -5 0 z" fill="${c}" ${s}/><path d="M30 14 a6 6 0 1 0 -6 6 v12 a2.5 2.5 0 0 0 5 0 z" fill="${c}" ${s}/><circle cx="12" cy="13" r="2" fill="#94A3B8"/><circle cx="28" cy="13" r="2" fill="#94A3B8"/>` },
    bottle: { label: "Water bottle", def: "#38BDF8", draw: (c) => `<rect x="15" y="3" width="10" height="6" rx="1.5" fill="#334155" ${s}/><path d="M13 12 Q13 9 16 9 H24 Q27 9 27 12 V35 Q27 37 25 37 H15 Q13 37 13 35 Z" fill="${c}" ${s}/><path d="M14 20 H26" stroke="#fff" stroke-width="1.4" opacity=".8"/><path d="M16 23 V33" stroke="#fff" stroke-width="2" opacity=".45" stroke-linecap="round"/>` },
    teacup: { label: "Cup of tea", def: "#F8FAFC", draw: (c) => `<path d="M14 6 q-2 3 0 6 M20 4 q-2 3 0 6" fill="none" stroke="#94A3B8" stroke-width="1.5"/><ellipse cx="19" cy="33" rx="16" ry="3.5" fill="${c}" ${s}/><path d="M7 17 H31 Q31 31 19 31 Q7 31 7 17 Z" fill="${c}" ${s}/><path d="M31 20 h2 a4 4 0 0 1 0 8 h-3" fill="none" stroke="${OL}" stroke-width="2"/><path d="M8 18 H30" stroke="#B45309" stroke-width="2.5"/><path d="M24 18 L28 26" stroke="#94A3B8" stroke-width="1"/><rect x="26" y="25" width="5" height="5" fill="#16A34A"/>` },
    candy: { label: "Bowl of candy", def: "#BAE6FD", draw: (c) => `${[[11, 16, "#EF4444"], [17, 13, "#FACC15"], [23, 15, "#22C55E"], [29, 17, "#A855F7"], [20, 18, "#F97316"], [14, 19, "#3B82F6"]].map(([x, y, f]) => `<circle cx="${x}" cy="${y}" r="4" fill="${f}" stroke="${OL}" stroke-width="1"/>`).join("")}<path d="M4 20 H36 Q34 35 20 35 Q6 35 4 20 Z" fill="${c}" opacity=".9" ${s}/><path d="M9 25 Q20 30 31 25" fill="none" stroke="#fff" stroke-width="1.5" opacity=".7"/>` },
    shells: { label: "Shells and beach rocks", def: "#FBCFE8", draw: (c) => `<path d="M6 30 L14 12 L22 30 Z" fill="${c}" ${s}/><path d="M14 12 L10 30 M14 12 L14 30 M14 12 L18 30" stroke="${OL}" stroke-width="1" opacity=".5"/><ellipse cx="14" cy="31" rx="9" ry="2.5" fill="${c}" ${s}/><ellipse cx="29" cy="31" rx="7" ry="5" fill="#94A3B8" ${s}/><ellipse cx="25" cy="22" rx="4" ry="3" fill="#CBD5E1" ${s}/><ellipse cx="34" cy="24" rx="3" ry="2.5" fill="#64748B" ${s}/>` },
    mic: { label: "Microphone on a boom arm", def: "#1F2937", draw: (c) => `<rect x="2" y="33" width="10" height="5" rx="1" fill="#475569" ${s}/><path d="M7 33 L12 14 L28 8" fill="none" stroke="#64748B" stroke-width="2.6" stroke-linejoin="round"/><g transform="rotate(-30 31 12)"><rect x="25" y="2" width="12" height="20" rx="6" fill="${c}" ${s}/><path d="M27 8h8M27 12h8M27 16h8" stroke="#94A3B8" stroke-width="1.2"/></g>` },
    audio: { label: "Audio gear and cables", def: "#475569", draw: (c) => `<rect x="4" y="8" width="32" height="14" rx="2" fill="${c}" ${s}/>${[10, 18, 26].map((x) => `<circle cx="${x}" cy="15" r="3" fill="#E5E7EB" stroke="${OL}" stroke-width="1"/>`).join("")}<circle cx="32" cy="12" r="1.5" fill="#22C55E"/><path d="M10 22 C10 34 4 30 6 38 M20 22 C22 32 16 34 18 39 M30 22 C30 30 36 32 34 39" fill="none" stroke="#111827" stroke-width="1.8"/>` },
    guitar: { label: "Guitar", def: "#DC2626", draw: (c) => `<rect x="25" y="1" width="6" height="5" rx="1" fill="#334155" ${s}/><path d="M27 6 L22 22" stroke="#92400E" stroke-width="4"/><path d="M14 18 C8 16 4 22 7 27 C4 32 9 39 15 36 C19 39 26 35 24 29 C28 25 24 18 19 21 Z" fill="${c}" ${s}/><circle cx="15" cy="28" r="2.4" fill="#111827"/><path d="M11 32 L21 25" stroke="#E5E7EB" stroke-width="1.2"/>` },
    petcat: { label: "Cat (the real one)", def: "#6B7280", draw: (c) => `<path d="M31 34 C40 32 39 22 33 24" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/><path d="M31 34 C40 32 39 22 33 24" fill="none" stroke="${OL}" stroke-width="1" opacity=".4"/><ellipse cx="22" cy="28" rx="10" ry="9" fill="${c}" ${s}/><path d="M9 13 L10 4 L15 9 Z M21 13 L20 4 L15 9 Z" fill="${c}" ${s}/><circle cx="15" cy="15" r="7.5" fill="${c}" ${s}/><circle cx="12.5" cy="14" r="1.3" fill="#FACC15"/><circle cx="17.5" cy="14" r="1.3" fill="#FACC15"/><path d="M14 18 l1 1 l1 -1" fill="none" stroke="#F472B6" stroke-width="1.2"/><ellipse cx="17" cy="35" rx="4" ry="2" fill="${c}" ${s}/>` },
    puppy: { label: "Puppy plushie", def: "#60A5FA", draw: (c) => `<ellipse cx="20" cy="31" rx="10" ry="8" fill="${c}" ${s}/><circle cx="20" cy="17" r="10" fill="${c}" ${s}/><path d="M11 9 Q4 12 7 22 Q11 20 12 13 Z M29 9 Q36 12 33 22 Q29 20 28 13 Z" fill="${shade(c, 0.7)}" ${s}/><ellipse cx="20" cy="21" rx="5.5" ry="4" fill="#FDE7C8"/><circle cx="16" cy="15" r="1.5" fill="${OL}"/><circle cx="24" cy="15" r="1.5" fill="${OL}"/><ellipse cx="20" cy="19.5" rx="1.8" ry="1.3" fill="${OL}"/>` },
    wipes: { label: "Baby wipes", def: "#E0F2FE", draw: (c) => `<rect x="4" y="14" width="32" height="20" rx="5" fill="${c}" ${s}/><rect x="12" y="11" width="16" height="7" rx="3.5" fill="#38BDF8" ${s}/><path d="M17 11 q3 -6 6 0" fill="#fff" stroke="${OL}" stroke-width="1"/><path d="M8 26 H32" stroke="#F472B6" stroke-width="3"/><circle cx="20" cy="26" r="3" fill="#FDE68A"/>` },
    coaster: { label: "Coaster", def: "#92400E", draw: (c) => `<ellipse cx="20" cy="27" rx="17" ry="8" fill="${c}" ${s}/><ellipse cx="20" cy="26" rx="12" ry="5" fill="none" stroke="#FDE68A" stroke-width="1.4" opacity=".8"/><rect x="16" y="23" width="8" height="5" rx="1" fill="#FDE68A" opacity=".85"/>` },
    speaker: { label: "Music speaker", def: "#1F2937", draw: (c) => `<rect x="9" y="7" width="20" height="30" rx="3" fill="${c}" ${s}/><circle cx="19" cy="15" r="4" fill="#475569" stroke="#94A3B8" stroke-width="1"/><circle cx="19" cy="27" r="6" fill="#475569" stroke="#94A3B8" stroke-width="1"/><circle cx="19" cy="27" r="2" fill="#94A3B8"/><path d="M32 8 v8 a2 2 0 1 1 -2 -2 M32 8 l5 -2 v7" fill="none" stroke="#A78BFA" stroke-width="1.6"/>` },
    sticky: { label: "Sticky notes", def: "#FDE047", draw: (c) => `<rect x="5" y="12" width="20" height="20" rx="1.5" fill="#F9A8D4" ${s} transform="rotate(-10 15 22)"/><rect x="16" y="8" width="20" height="20" rx="1.5" fill="#86EFAC" ${s} transform="rotate(8 26 18)"/><rect x="10" y="16" width="20" height="20" rx="1.5" fill="${c}" ${s}/><path d="M13 22h14M13 26h11M13 30h13" stroke="${OL}" stroke-width="1.1" opacity=".5"/>` },
    buddha: { label: "Laughing Buddha figure", def: "#E3B341", draw: (c) => `<ellipse cx="20" cy="36" rx="13" ry="3" fill="#92400E" ${s}/><ellipse cx="20" cy="27" rx="12" ry="9" fill="${c}" ${s}/><circle cx="20" cy="29" r="4.5" fill="${shade(c, 1.15)}"/><path d="M9 22 Q4 14 9 9 M31 22 Q36 14 31 9" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="13" r="7.5" fill="${c}" ${s}/><path d="M16 12 q1.5 -1.5 3 0 M21 12 q1.5 -1.5 3 0" fill="none" stroke="${OL}" stroke-width="1.1"/><path d="M16.5 15.5 Q20 19 23.5 15.5" fill="#7F1D1D" stroke="${OL}" stroke-width="1"/>` },
    aquarium: { label: "Aquarium", def: "#38BDF8", draw: (c) => `<rect x="3" y="9" width="34" height="25" rx="2" fill="${c}" opacity=".55" ${s}/><rect x="3" y="7" width="34" height="4" rx="1" fill="#334155" ${s}/><rect x="3" y="33" width="34" height="4" rx="1" fill="#334155" ${s}/><path d="M9 33 q-2 -7 1 -12 M12 33 q2 -6 -1 -10 M32 33 q-3 -8 0 -13" fill="none" stroke="#16A34A" stroke-width="1.8"/>${[[14, 17, "#F97316"], [27, 21, "#EF4444"], [17, 26, "#FB923C"]].map(([x, y, f]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="2.6" fill="${f}" stroke="${OL}" stroke-width=".8"/><path d="M${x - 4} ${y} l-3 -2.2 v4.4 z" fill="${f}"/><circle cx="${x + 2}" cy="${y - 1.2}" r="1.1" fill="#7F1D1D"/>`).join("")}<circle cx="23" cy="14" r="1" fill="#fff" opacity=".8"/><circle cx="25" cy="11.5" r=".8" fill="#fff" opacity=".8"/>` },
  };
  function itemSVG(type, color) {
    const it = ITEMS[type]; if (!it) return "";
    const c = /^#[0-9a-f]{6}$/i.test(color || "") ? color : it.def;
    return `<svg viewBox="0 0 40 40" aria-hidden="true">${it.draw(c)}</svg>`;
  }
  const itemLabel = (t, color) => { const it = ITEMS[t]; if (!it) return ""; return it.label; };

  /* ---------- floor decor ---------- */
  const DECOR = {
    bigplant: { label: "Plant", w: 28, h: 40, def: "#C2410C", draw: (c) => `<path d="M14 26 C2 22 0 8 5 4 C10 12 12 16 14 26Z M14 26 C26 22 28 8 23 4 C18 12 16 16 14 26Z" fill="#3E9B5F" ${s}/><path d="M14 26 C10 14 14 2 14 2 C17 12 17 18 14 26Z" fill="#6FCF8F" ${s}/><path d="M6 26 H22 L20 39 H8 Z" fill="${c}" ${s}/>` },
    sofa: { label: "Sofa", w: 92, h: 44, def: "#6366F1", draw: (c) => `<rect x="4" y="4" width="84" height="22" rx="8" fill="${c}" ${s}/><rect x="2" y="16" width="14" height="24" rx="6" fill="${c}" ${s}/><rect x="76" y="16" width="14" height="24" rx="6" fill="${c}" ${s}/><rect x="14" y="20" width="64" height="18" rx="5" fill="${c}" ${s} opacity=".9"/><path d="M46 21v16" stroke="${OL}" stroke-width="1.2" opacity=".5"/>` },
    beanbag: { label: "Beanbag", w: 38, h: 32, def: "#F472B6", draw: (c) => `<path d="M4 26 C0 12 10 3 19 3 C30 3 38 13 34 26 C30 31 8 31 4 26Z" fill="${c}" ${s}/><path d="M10 14 q9 6 18 0" fill="none" stroke="${OL}" stroke-width="1.2" opacity=".4"/>` },
    coffee: { label: "Coffee machine", w: 34, h: 46, def: "#334155", draw: (c) => `<rect x="3" y="3" width="28" height="40" rx="3" fill="${c}" ${s}/><rect x="7" y="7" width="20" height="9" rx="2" fill="#0EA5E9"/><rect x="11" y="22" width="12" height="4" fill="#1E293B"/><rect x="12" y="31" width="10" height="9" rx="1.5" fill="#fff" ${s}/><circle cx="9" cy="20" r="1.6" fill="#22C55E"/>` },
    cooler: { label: "Water cooler", w: 26, h: 50, def: "#E2E8F0", draw: () => `<path d="M6 4 H20 V16 H6 Z" fill="#7DD3FC" ${s} opacity=".9"/><rect x="4" y="16" width="18" height="31" rx="2" fill="#E2E8F0" ${s}/><rect x="9" y="22" width="3" height="4" fill="#EF4444"/><rect x="14" y="22" width="3" height="4" fill="#3B82F6"/>` },
    shelf: { label: "Bookshelf", w: 70, h: 44, def: "#92400E", draw: (c) => `<rect x="2" y="2" width="66" height="40" rx="2" fill="${c}" ${s}/><path d="M4 22h62" stroke="${OL}" stroke-width="1.6"/>` + ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6"].map((b, i) => `<rect x="${6 + i * 8.5}" y="${i % 2 ? 7 : 5}" width="6" height="${i % 2 ? 14 : 16}" fill="${b}"/><rect x="${8 + i * 8.5}" y="${i % 3 ? 26 : 24}" width="6" height="${i % 3 ? 15 : 17}" fill="${b}" opacity=".85"/>`).join("") },
    whiteboard: { label: "Whiteboard", w: 82, h: 52, def: "#94A3B8", draw: (c) => `<rect x="3" y="3" width="76" height="40" rx="2" fill="#F8FAFC" stroke="${c}" stroke-width="3"/><path d="M10 12 h28 M10 19 h40 M10 26 h20" stroke="#3B82F6" stroke-width="2"/><path d="M56 14 l10 10 m0-10 l-10 10" stroke="#EF4444" stroke-width="2"/><path d="M20 43 l-6 8 M62 43 l6 8" stroke="${OL}" stroke-width="2"/>` },
    pingpong: { label: "Table tennis", w: 100, h: 58, def: "#15803D", draw: (c) => `<rect x="4" y="4" width="92" height="44" rx="2" fill="${c}" ${s}/><path d="M50 4v44" stroke="#fff" stroke-width="2"/><path d="M4 26h92" stroke="#fff" stroke-width="1" opacity=".7"/><path d="M12 48v8M88 48v8" stroke="${OL}" stroke-width="2.4"/><circle cx="30" cy="16" r="2.4" fill="#FB923C"/>` },
    rug: { label: "Rug", w: 120, h: 70, def: "#A78BFA", draw: (c) => `<ellipse cx="60" cy="35" rx="58" ry="33" fill="${c}" opacity=".55" ${s}/><ellipse cx="60" cy="35" rx="44" ry="23" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>` },
    arcade: { label: "Arcade machine", w: 36, h: 54, def: "#DB2777", draw: (c) => `<path d="M4 4 H32 V50 H4 Z" fill="${c}" ${s}/><rect x="8" y="9" width="20" height="16" fill="#0F172A"/><path d="M11 20 l4-6 l4 4 l5-5" stroke="#22D3EE" stroke-width="1.6" fill="none"/><rect x="6" y="28" width="24" height="7" fill="#1E293B"/><circle cx="12" cy="31.5" r="1.8" fill="#FACC15"/><circle cx="24" cy="31.5" r="1.8" fill="#22C55E"/>` },
  };
  function decorSVG(type, color) {
    const d = DECOR[type]; if (!d) return "";
    const c = /^#[0-9a-f]{6}$/i.test(color || "") ? color : d.def;
    return `<svg viewBox="0 0 ${d.w} ${d.h}" width="${d.w}" height="${d.h}" aria-hidden="true">${d.draw(c)}</svg>`;
  }

  root.VO_ART = { CAST, charSVG, AVATAR_OPTIONS, presetSpec, normAvatar, SKIN, ITEMS, itemSVG, itemLabel, DECOR, decorSVG };
})(window);
