(() => {
  'use strict';
  const button = document.getElementById('sun-button');
  const canvas = document.getElementById('sun-canvas');
  if (!button || !canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, baseRadius = 0, particles = [];
  let shape = 0, previousShape = 0, morph = 1, t = 0, last = 0;
  let currentPalette = 0, ripple = null;
  const pointer = { x: -10000, y: -10000, active: false };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = x => x * x * (3 - 2 * x);

  // Center color and edge color for each of the seven states.
  // Edit these RGB triplets to customize the color sequence.
  const palettes = [
    [[159, 229, 43], [23, 111, 75]],  // Chartreuse / emerald
    [[107, 245, 150], [0, 120, 105]], // Mint / deep teal
    [[89, 221, 224], [21, 91, 175]],  // Aqua / blue
    [[126, 171, 255], [65, 56, 160]], // Sky blue / indigo
    [[207, 147, 255], [104, 43, 151]],// Lilac / violet
    [[255, 143, 190], [160, 46, 113]],// Pink / magenta
    [[245, 219, 91], [91, 154, 47]]   // Golden lime / green
  ];
  const lerp = (a, b, f) => a + (b - a) * f;
  const mixColor = (a, b, f) => [
    Math.round(lerp(a[0], b[0], f)),
    Math.round(lerp(a[1], b[1], f)),
    Math.round(lerp(a[2], b[2], f))
  ];
  function paletteColor(index, radial) {
    const colors = palettes[index];
    return mixColor(colors[0], colors[1], radial);
  }
  function boundary(a, s) {
    switch (s) {
      case 1: return 1 + .12 * Math.sin(3 * a + .4) + .055 * Math.cos(5 * a - .2);
      case 2: return 1 + .15 * Math.cos(4 * a + .5) + .025 * Math.sin(9 * a);
      case 3: return 1 + .19 * Math.sin(2 * a + .8) + .065 * Math.cos(5 * a);
      case 4: return 1 + .11 * Math.cos(6 * a) + .08 * Math.sin(3 * a + .3);
      case 5: return 1 + .18 * Math.sin(a + 1) + .075 * Math.cos(4 * a - .5);
      case 6: return 1 + .13 * Math.sin(5 * a + .4) + .09 * Math.cos(2 * a - .6);
      default: return 1;
    }
  }
  function resize() {
    const box = canvas.getBoundingClientRect();
    width = box.width; height = box.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseRadius = Math.min(width * .42, height * .44, 260);
    const spacing = width < 450 ? 4.6 : 4.2;
    particles = [];
    for (let y = -baseRadius * 1.34; y <= baseRadius * 1.34; y += spacing) {
      for (let x = -baseRadius * 1.34; x <= baseRadius * 1.34; x += spacing) {
        const d = Math.hypot(x, y) / baseRadius;
        if (d > 1.31) continue;
        const a = Math.atan2(y, x);
        const p = { x, y, d, a, dx: 0, dy: 0, vx: 0, vy: 0, color: paletteColor(currentPalette, clamp(d, 0, 1)) };
        // Keep the center-outward transition in progress when the viewport changes.
        if (ripple) {
          const distance = Math.hypot(x, y);
          const transition = smooth(clamp((ripple.distance - distance) / ripple.softness, 0, 1));
          p.color = mixColor(paletteColor(currentPalette, clamp(d, 0, 1)), paletteColor(ripple.to, clamp(d, 0, 1)), transition);
        }
        particles.push(p);
      }
    }
    if (ripple) ripple.startColors = new Map(particles.map(p => [p, paletteColor(currentPalette, clamp(p.d, 0, 1))]));
    draw();
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    const cx = width * .53, cy = height * .49;
    const breath = reduceMotion.matches ? 1 : 1 + .018 * Math.sin(t * 1.4);
    const blend = smooth(morph);
    for (const p of particles) {
      const radius = boundary(p.a, previousShape) * (1 - blend) + boundary(p.a, shape) * blend;
      const edge = (radius - p.d) * baseRadius;
      if (edge <= 0) continue;
      const alpha = smooth(clamp(edge / 12, 0, 1));
      const px = cx + p.x * breath, py = cy + p.y * breath;
      if (!reduceMotion.matches) {
        const dx = px + p.dx - pointer.x, dy = py + p.dy - pointer.y;
        const dist = Math.hypot(dx, dy);
        if (pointer.active && dist < 75 && dist > 0) {
          const force = (1 - dist / 75) ** 2 * 2.1;
          p.vx += dx / dist * force; p.vy += dy / dist * force;
        }
        p.vx = (p.vx - p.dx * .075) * .79;
        p.vy = (p.vy - p.dy * .075) * .79;
        p.dx += p.vx; p.dy += p.vy;
      }
      if (ripple) {
        const distance = Math.hypot(p.x, p.y);
        const transition = smooth(clamp((ripple.distance - distance) / ripple.softness, 0, 1));
        const target = paletteColor(ripple.to, clamp(p.d, 0, 1));
        // Snapshot each particle's actual color at click time, so even rapid
        // repeated clicks produce a continuous transition with no color jumps.
        const source = ripple.startColors.get(p) || p.color;
        p.color = mixColor(source, target, transition);
      }
      const [red, green, blue] = p.color;
      ctx.fillStyle = `rgba(${red},${green},${blue},${alpha})`;
      const dot = (1.95 - .38 * clamp(p.d, 0, 1)) * Math.min(1, edge / 4);
      ctx.beginPath(); ctx.arc(px + p.dx, py + p.dy, dot, 0, Math.PI * 2); ctx.fill();
    }
  }
  function tick(ms) {
    const dt = Math.min((ms - last) / 1000 || .016, .05); last = ms;
    if (!reduceMotion.matches) t += dt;
    if (morph < 1) morph = Math.min(1, morph + dt * 1.7);
    if (ripple) {
      ripple.distance += dt * ripple.speed;
      if (ripple.distance > ripple.maxDistance + ripple.softness) {
        currentPalette = ripple.to;
        for (const p of particles) p.color = paletteColor(currentPalette, clamp(p.d, 0, 1));
        ripple = null;
      }
    }
    draw();
    requestAnimationFrame(tick);
  }
  button.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.active = true;
  });
  button.addEventListener('pointerleave', () => { pointer.active = false; });
  button.addEventListener('click', e => {
    previousShape = shape;
    shape = (shape + 1) % 7;
    morph = reduceMotion.matches ? 1 : 0;
    // The color ripple always starts at the SUN CENTER, independent of click position.
    // This prevents the new palette appearing at an edge during a shape morph.
    const target = (currentPalette + 1) % palettes.length;
    // The next click advances from the previous target, even mid-animation.
    const next = ripple ? (ripple.to + 1) % palettes.length : target;
    if (reduceMotion.matches) {
      currentPalette = next;
      ripple = null;
      for (const p of particles) p.color = paletteColor(next, clamp(p.d, 0, 1));
    } else {
      const startColors = new Map(particles.map(p => [p, p.color.slice()]));
      // Include all possible dots, including those revealed by the next blob shape.
      const maxDistance = baseRadius * 1.34;
      ripple = { distance: 0, softness: 36, speed: 310, maxDistance, to: next, startColors };
    }
    button.setAttribute('aria-label', `Halftone sun, shape ${shape + 1} of 7. Activate to change shape and color.`);
    draw();
  });
  new ResizeObserver(resize).observe(canvas);
  resize(); requestAnimationFrame(tick);
})();
