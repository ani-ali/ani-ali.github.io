/* --- 1. DRAGGABLE SCROLLBAR LOGIC --- */
const thumb = document.getElementById('scroll-thumb');
let isDragging = false;
let startY, startTop;

function updateScrollThumb() {
  if (isDragging) return;

  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight;
  const winHeight = window.innerHeight;

  if (docHeight <= winHeight) {
    thumb.style.display = 'none';
    return;
  }
  thumb.style.display = 'flex';

  const scrollPercent = scrollTop / (docHeight - winHeight);
  const maxTop = winHeight - 40;
  const topPos = Math.min(Math.max(scrollPercent * maxTop, 0), maxTop);

  thumb.style.top = `${topPos}px`;
}

thumb.addEventListener('mousedown', (e) => {
  isDragging = true;
  startY = e.clientY;
  startTop = parseInt(thumb.style.top || 0);
  document.body.style.userSelect = 'none';
  thumb.style.borderColor = 'var(--text-main)';
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  e.preventDefault();
  const deltaY = e.clientY - startY;
  const winHeight = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;
  const maxTop = winHeight - 40;
  let newTop = startTop + deltaY;
  newTop = Math.max(0, Math.min(newTop, maxTop));
  thumb.style.top = `${newTop}px`;
  const scrollPercent = newTop / maxTop;
  const scrollPos = scrollPercent * (docHeight - winHeight);
  window.scrollTo(0, scrollPos);
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  document.body.style.userSelect = '';
  thumb.style.borderColor = '';
});

window.addEventListener('scroll', updateScrollThumb);
window.addEventListener('resize', updateScrollThumb);
updateScrollThumb();


/* --- 2. THEME TOGGLE & ANIMATION MANAGEMENT --- */
let animationFrameId = null;

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.classList.contains('dark');

  if (isDark) {
    html.classList.remove('dark');
    html.classList.add('light');
    localStorage.setItem('theme', 'light');
  } else {
    html.classList.remove('light');
    html.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }

  // Restart the animation cleanly
  start();
}


/* --- 3. COBWEB THREAD ANIMATION --- */
const { Engine, Bodies, Composite, Constraint, Mouse, MouseConstraint, Runner } = Matter;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

const engine = Engine.create({
  gravity: { x: 0, y: 0.05 }
});

const mouse = Mouse.create(canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse: mouse,
  constraint: {
    stiffness: 0.05,
    damping: 0.1,
    render: { visible: false }
  }
});
Composite.add(engine.world, mouseConstraint);


let threadCount = 0;
const maxThreads = 150;

const allThreads = [];
const allBodies = [];
const webConnections = [];

// Create thread anchored to walls
function createWallThread(startX, startY, endX, endY, thickness, opacity) {
  const distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
  const segments = Math.floor(distance / 35) + 3;
  const dx = (endX - startX) / segments;
  const dy = (endY - startY) / segments;

  const bodies = [];
  const constraints = [];
  const isDark = document.documentElement.classList.contains('dark');
  const color = isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;

  for (let i = 0; i <= segments; i++) {
    const x = startX + dx * i;
    const y = startY + dy * i;

    const body = Bodies.circle(x, y, 5, {
      friction: 0.5,
      frictionAir: 0.02,
      restitution: 0.05,
      collisionFilter: {
        group: -1,
        category: 0x0002,
        mask: 0x0001
      }
    });

    bodies.push(body);
    allBodies.push(body);

    if (i > 0) {
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      const constraint = Constraint.create({
        bodyA: bodies[i - 1],
        bodyB: body,
        length: segmentLength * 0.95,
        stiffness: 0.63 + Math.random() * 0.22,
        damping: 0.15
      });
      constraints.push({ constraint, thickness, color });
    }
  }

  // Wall anchors
  constraints.push({
    constraint: Constraint.create({
      pointA: { x: startX, y: startY },
      bodyB: bodies[0],
      length: 0,
      stiffness: 1
    }),
    thickness: 0,
    color: 'transparent'
  });

  constraints.push({
    constraint: Constraint.create({
      pointA: { x: endX, y: endY },
      bodyB: bodies[bodies.length - 1],
      length: 0,
      stiffness: 1
    }),
    thickness: 0,
    color: 'transparent'
  });

  constraints.forEach(c => Composite.add(engine.world, c.constraint));
  Composite.add(engine.world, bodies);

  allThreads.push({ bodies, constraints, thickness, color });
}

// Create thread connected to other threads
function createThreadToThread(thickness, opacity) {
  if (allBodies.length < 10) return false;

  const bodyA = allBodies[Math.floor(Math.random() * allBodies.length)];
  let bodyB = allBodies[Math.floor(Math.random() * allBodies.length)];

  let attempts = 0;
  while (attempts < 20) {
    bodyB = allBodies[Math.floor(Math.random() * allBodies.length)];
    const dx = bodyA.position.x - bodyB.position.x;
    const dy = bodyA.position.y - bodyB.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (bodyA !== bodyB && dist > 50 && dist < 300) break;
    attempts++;
  }

  if (bodyA === bodyB) return false;

  const startX = bodyA.position.x;
  const startY = bodyA.position.y;
  const endX = bodyB.position.x;
  const endY = bodyB.position.y;

  const distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
  const segments = Math.floor(distance / 30) + 2;
  const dx = (endX - startX) / segments;
  const dy = (endY - startY) / segments;

  const bodies = [];
  const constraints = [];
  const isDark = document.documentElement.classList.contains('dark');
  const color = isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;

  for (let i = 0; i <= segments; i++) {
    const x = startX + dx * i;
    const y = startY + dy * i;

    const body = Bodies.circle(x, y, 5, {
      friction: 0.5,
      frictionAir: 0.02,
      restitution: 0.05,
      collisionFilter: {
        group: -1,
        category: 0x0002,
        mask: 0x0001
      }
    });

    bodies.push(body);
    allBodies.push(body);

    if (i > 0) {
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      const constraint = Constraint.create({
        bodyA: bodies[i - 1],
        bodyB: body,
        length: segmentLength * 0.9,
        stiffness: 0.5 + Math.random() * 0.2,
        damping: 0.15
      });
      constraints.push({ constraint, thickness, color });
    }
  }

  constraints.push({
    constraint: Constraint.create({
      bodyA: bodyA,
      bodyB: bodies[0],
      length: 0,
      stiffness: 0.8
    }),
    thickness: thickness * 0.8,
    color: color
  });

  constraints.push({
    constraint: Constraint.create({
      bodyA: bodyB,
      bodyB: bodies[bodies.length - 1],
      length: 0,
      stiffness: 0.8
    }),
    thickness: thickness * 0.8,
    color: color
  });

  constraints.forEach(c => Composite.add(engine.world, c.constraint));
  Composite.add(engine.world, bodies);

  allThreads.push({ bodies, constraints, thickness, color });
  return true;
}

// Web connections between nearby bodies
function createWebConnections() {
  const connectionDistance = 80;
  let connectionsAdded = 0;
  const maxNewConnections = 25;

  for (let i = 0; i < allBodies.length && connectionsAdded < maxNewConnections; i += 3) {
    for (let j = i + 1; j < allBodies.length && connectionsAdded < maxNewConnections; j += 3) {
      const bodyA = allBodies[i];
      const bodyB = allBodies[j];

      const dx = bodyA.position.x - bodyB.position.x;
      const dy = bodyA.position.y - bodyB.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < connectionDistance && Math.random() > 0.85) {
        const opacity = 0.06 + Math.random() * 0.12;
        const isDark = document.documentElement.classList.contains('dark');
        const color = isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;

        const constraint = Constraint.create({
          bodyA: bodyA,
          bodyB: bodyB,
          length: dist,
          stiffness: 0.36,
          damping: 0.1
        });

        Composite.add(engine.world, constraint);
        webConnections.push({
          constraint,
          thickness: 0.15 + Math.random() * 0.2,
          color: color
        });
        connectionsAdded++;
      }
    }
  }
}

function getWallPositions() {
  const cornerWidth = width * 0.5;
  const cornerHeight = height * 0.5;

  const corners = [
    {
      getStart: () => ({ x: Math.random() * cornerWidth, y: -5 }),
      getEnd: () => ({ x: -5, y: Math.random() * cornerHeight })
    },
    {
      getStart: () => ({ x: width - Math.random() * cornerWidth, y: -5 }),
      getEnd: () => ({ x: width + 5, y: Math.random() * cornerHeight })
    },
    {
      getStart: () => ({ x: -5, y: height - Math.random() * cornerHeight }),
      getEnd: () => ({ x: Math.random() * cornerWidth, y: height + 5 })
    },
    {
      getStart: () => ({ x: width + 5, y: height - Math.random() * cornerHeight }),
      getEnd: () => ({ x: width - Math.random() * cornerWidth, y: height + 5 })
    }
  ];

  const corner = corners[Math.floor(Math.random() * corners.length)];
  return { start: corner.getStart(), end: corner.getEnd() };
}

// Render
function render() {
  const isDark = document.documentElement.classList.contains('dark');
  const bg = isDark ? '#050505' : '#ffffff';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Draw threads
  allThreads.forEach(thread => {
    thread.constraints.forEach(({ constraint, thickness, color }) => {
      if (thickness === 0) return;

      const bodyA = constraint.bodyA;
      const bodyB = constraint.bodyB;

      if (bodyA && bodyB) {
        ctx.beginPath();
        ctx.moveTo(bodyA.position.x, bodyA.position.y);
        ctx.lineTo(bodyB.position.x, bodyB.position.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.stroke();
      }
    });
  });

  // Draw web connections
  webConnections.forEach(({ constraint, thickness, color }) => {
    const bodyA = constraint.bodyA;
    const bodyB = constraint.bodyB;

    if (bodyA && bodyB) {
      ctx.beginPath();
      ctx.moveTo(bodyA.position.x, bodyA.position.y);
      ctx.lineTo(bodyB.position.x, bodyB.position.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.stroke();
    }
  });

  animationFrameId = requestAnimationFrame(render);
}

// Spawn schedule
const spawnSchedule = [];
let currentTime = 20;

while (spawnSchedule.length < maxThreads) {
  const batchSize = Math.floor(Math.random() * 2) + 1;
  for (let i = 0; i < batchSize && spawnSchedule.length < maxThreads; i++) {
    spawnSchedule.push(currentTime + i * 3);
  }
  currentTime += 10 + Math.floor(Math.random() * 12);
}

spawnSchedule.forEach((delay, index) => {
  setTimeout(() => {
    if (threadCount >= maxThreads) return;

    const thickness = 0.2 + Math.random() * 0.4;
    const opacity = 0.15 + Math.random() * 0.25;

    if (threadCount > 15 && Math.random() < 0.2) {
      if (createThreadToThread(thickness, opacity)) {
        threadCount++;
      } else {
        const positions = getWallPositions();
        createWallThread(
          positions.start.x,
          positions.start.y,
          positions.end.x,
          positions.end.y,
          thickness,
          opacity
        );
        threadCount++;
      }
    } else {
      const positions = getWallPositions();
      createWallThread(
        positions.start.x,
        positions.start.y,
        positions.end.x,
        positions.end.y,
        thickness,
        opacity
      );
      threadCount++;
    }

    if (threadCount % 15 === 0) {
      createWebConnections();
    }

  }, delay);
});

// Final web connections
setTimeout(() => {
  createWebConnections();
}, currentTime + 300);

const runner = Runner.create();
Runner.run(runner, engine);

function start() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  // Update colors for all threads on theme change
  allThreads.forEach(thread => {
    const isDark = document.documentElement.classList.contains('dark');
    thread.constraints.forEach(c => {
      if (c.color !== 'transparent') {
        const opacity = parseFloat(c.color.match(/[\d.]+\)$/)?.[0]) || 0.3;
        c.color = isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;
      }
    });
  });

  // Update web connections colors
  webConnections.forEach(conn => {
    const isDark = document.documentElement.classList.contains('dark');
    const opacity = parseFloat(conn.color.match(/[\d.]+\)$/)?.[0]) || 0.1;
    conn.color = isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;
  });

  render();
}

window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
});

// Start animation
start();
