// main.js

import kaplay from "kaplay";

kaplay();

loadSprite("sled", "sprites/sled.png");
loadSprite("penguin", "sprites/penguin.png");
loadSprite("ice_bg", "sprites/bg3.png");
loadSprite("skybg", "sprites/skybg.png");
loadSprite("ice", "sprites/bg0.png");
loadSprite("float", "sprites/bg1.png");

const NUM_PLAYERS = 4;
const KEYS = ["q", "w", "e", "r"];

const SCREEN_CENTER_X = width() / 2;
const CLIFF_X = width() + 4850;

let BG_SPEED = 4;
let bg_accel = 0.075;
const TRANSITION_X = width() + 5000;

const ICE_FRICTION = 0.965;
const PULL_ACCEL = 0.3;
let MAX_SPEED = 8;
let bg_max_speed = 20;

// ----------------------
// DEBUG SLIDERS
// ----------------------

function createSlider(labelText, min, max, step, initialValue, onChange) {
  // Container
  const container = document.createElement("div");

  container.style.position = "absolute";
  container.style.right = "20px";
  container.style.zIndex = "1000";
  container.style.color = "white";
  container.style.fontFamily = "Arial";
  container.style.background = "rgba(0,0,0,0.5)";
  container.style.padding = "10px";
  container.style.borderRadius = "8px";
  container.style.width = "220px";
  container.style.backdropFilter = "blur(4px)";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "6px";

  // Label
  const label = document.createElement("div");
  label.innerText = labelText;

  // Value text
  const valueText = document.createElement("div");
  valueText.innerText = initialValue;

  label.style.fontSize = "18px";
  valueText.style.fontSize = "16px";

  // Slider
  const slider = document.createElement("input");
  slider.type = "range";

  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = initialValue;

  slider.style.width = "100%";

  slider.oninput = () => {
    valueText.innerText = slider.value;
    onChange(parseFloat(slider.value));
  };

  container.appendChild(label);
  container.appendChild(slider);
  container.appendChild(valueText);

  document.body.appendChild(container);

  return container;
}

// Acceleration slider
const accelSlider = createSlider(
  "Acceleration",
  0.01,
  1.0,
  0.01,
  bg_accel,
  (value) => {
    bg_accel = value;
  }
);

accelSlider.style.top = "20px";

// Max speed slider
const speedSlider = createSlider(
  "Max Speed",
  1,
  50,
  0.1,
  bg_max_speed,
  (value) => {
    bg_max_speed = value;
  }
);

speedSlider.style.top = "140px";

// ----------------------
// GAME STATE
// ----------------------
let players = [];
let gameStarted = false;
let gameOver = false;
let scrolling = true;

// ----------------------
// SCENE: GAME
// ----------------------
scene("game", () => {
  players = [];
  gameStarted = false;
  gameOver = false;
  scrolling = true;

  // ----------------------
  // BACKGROUND LOOP
  // ----------------------
  const bg = add([sprite("skybg"), pos(0, 0), scale(5.2)]);

  const bga = add([sprite("ice"), pos(0, 0), scale(5)]);
  const BGA_WIDTH = 1450;
  const bgb = add([sprite("ice"), pos(-BGA_WIDTH, 0), scale(5)]);
  const BGB_WIDTH = 1450;

  const bgc = add([sprite("float"), pos(0, 0), scale(5)]);
  const BGC_WIDTH = 1450;
  const bgd = add([sprite("float"), pos(-BGC_WIDTH, 0), scale(5)]);
  const BGD_WIDTH = 1450;

  const bg1 = add([
    sprite("ice_bg", { width: 1600 }),
    scale(vec2(1, 1)),
    pos(0, 0),
  ]);

  const bg2 = add([
    sprite("ice_bg", { width: 1600 }),
    scale(vec2(1, 1)),
    pos(-1600, 0),
  ]);

  function updateBackground() {
    if (!scrolling) {
      bg1.pos.x = 800;
      bg2.pos.x = 800;
    }
    if (!scrolling) return;

    BG_SPEED += bg_accel;
    BG_SPEED = Math.min(BG_SPEED, bg_max_speed);

    bg1.pos.x += BG_SPEED * 1.5;
    bg2.pos.x += BG_SPEED * 1.5;

    bga.pos.x += BG_SPEED * 0.5;
    bgb.pos.x += BG_SPEED * 0.5;

    bgc.pos.x += BG_SPEED;
    bgd.pos.x += BG_SPEED;

    // loop seamlessly
    
    if (bg1.pos.x + bg1.width > bg1.width * 2) {
      bg1.pos.x = bg2.pos.x - bg2.width;
    }
    if (bg2.pos.x + bg2.width > bg2.width * 2) {
      bg2.pos.x = bg1.pos.x - bg1.width;
    }
    

    if (bga.pos.x > BGA_WIDTH) {
      bga.pos.x = bga.pos.x - BGA_WIDTH;
    }
    if (bgb.pos.x + BGB_WIDTH > BGB_WIDTH) {
      bgb.pos.x = bgb.pos.x - BGB_WIDTH;
    }

    if (bgc.pos.x > BGC_WIDTH) {
      bgc.pos.x = bgc.pos.x - BGC_WIDTH;
    }
    if (bgd.pos.x + BGD_WIDTH > BGD_WIDTH) {
      bgd.pos.x = bgd.pos.x - BGD_WIDTH;
    }
  }

  // ----------------------
  // CLIFF
  // ----------------------
  const cliff = add([rect(20, height()), pos(CLIFF_X, 0), color(255, 0, 0)]);

  // ----------------------
  // DISTANCE METERS
  // ----------------------

  const distanceTexts = [];

  for (let i = 0; i < NUM_PLAYERS; i++) {
    const meter = add([
      text(""),
      pos(20, 20 + i * 40),
      fixed(),
      color(255, 255, 255),
      scale(1.2),
    ]);

    distanceTexts.push(meter);
  }

  // ----------------------
  // PLAYERS (CENTERED)
  // ----------------------
  for (let i = 0; i < NUM_PLAYERS; i++) {
    const y = 490 + i * 70;

    const sled = add([
      sprite("sled", { flipX: true }),
      pos(SCREEN_CENTER_X, y),
      scale(0.3),
      area(),
      rotate(0),
      {
        playerNumber: i + 1,
        velocity: 0,
        pulling: true,
        released: false,
        finished: false,
        distanceToCliff: null,
        penguin_removed: false,
      },
    ]);

    const penguin = sled.add([
      sprite("penguin", { flipX: true }),
      pos(SCREEN_CENTER_X - 1200, y - 400 - 60 * i),
      scale(0.9),
      rotate(0),
    ]);

    players.push({ sled, penguin });
  }

  // ----------------------
  // COUNTDOWN
  // ----------------------
  const countdownText = add([
    text("3"),
    pos(width() / 2, height() / 2),
    anchor("center"),
    scale(4),
  ]);

  let count = 4;

  loop(1, () => {
    count--;

    if (count > 0) {
      countdownText.text = String(count);
    } else if (count === 0) {
      countdownText.text = "GO!";
    } else {
      destroy(countdownText);
      gameStarted = true;
    }
  });

  // ----------------------
  // CONTROLS
  // ----------------------
  KEYS.forEach((key, i) => {
    onKeyPress(key, () => {
      if (!gameStarted) return;

      const player = players[i];
      if (!player) return;

      if (!player.sled.released) {
        player.sled.released = true;
        player.sled.pulling = false;

        const penguin = player.penguin;
        const sled = player.sled;

        // Convert to world position BEFORE detaching
        const worldPos = penguin.worldPos();

        // Detach from sled
        if (!player.sled.penguin_removed) {
          sled.remove(penguin);
          add(penguin);

          // Keep it visually in same place
          penguin.pos = worldPos;

          penguin.scaleBy(0.9);

          // Give it independent movement
          penguin.velocity = player.sled.velocity;
          // destroy(player.penguin);
          penguin.falling = false;
          penguin.vy = 0;

          player.sled.penguin_removed = true;
        }

        // if (player.sled.penguin_removed) {
        //   // Keep it visually in same place
        //   penguin.pos = worldPos;

        //   penguin.scaleBy(0.9);

        //   // Give it independent movement
        //   penguin.velocity = player.sled.velocity;
        //   // destroy(player.penguin);
        //   penguin.falling = false;
        //   penguin.vy = 0;
        // }
      }
    });
  });

  function updatePhysics() {}

  function updatePenguins() {}

  function updateDistanceUI() {}

  // ----------------------
  // UPDATE LOOP
  // ----------------------
  onUpdate(() => {
    if (!gameStarted || gameOver) return;

    updateBackground();

    let allStopped = true;

    players.forEach(({ sled, penguin }) => {
      //   if (sled.finished) return;

      if (sled.released && penguin) {
        // Check if penguin reaches cliff
        if (!penguin.falling && scrolling == false) {
          penguin.falling = true;
          penguin.vy = 2; // initial drop
          sled.vy = 2;
        }

        if (!penguin.falling) {
          // slide on ice
          penguin.velocity *= ICE_FRICTION;
          penguin.pos.x -= penguin.velocity;
          sled.pos.x += BG_SPEED * 2;
          penguin.scaleTo(0.27);
        } else {
          // falling motion
          penguin.vy += 2; // gravity
          penguin.pos.y += penguin.vy;
          penguin.pos.x -= 4;
          penguin.scaleTo(0.27);
          penguin.angle -= 2;

          //   if (penguin.pos.y > height()) {
          //     destroy(penguin);
          //     // spawn splash sprite here
          //   }
        }
      }

      // ----------------------
      // PHASE 1: SCROLLING WORLD
      // ----------------------
      if (scrolling) {
        if (!sled.released) {
          sled.velocity += PULL_ACCEL;
          sled.velocity = Math.min(sled.velocity, MAX_SPEED);
        }
      }
      //   else {
      //       //   sled.velocity *= ICE_FRICTION;

      //       //   sled.pos.x += BG_SPEED * 2;
      //       if (penguin) {
      //         penguin.velocity *= ICE_FRICTION;
      //         penguin.pos.x -= penguin.velocity;
      //         sled.pos.x += BG_SPEED * 2;
      //         penguin.scaleTo(0.27);
      //       }
      //     }

      // Instead of moving sled → move "world position"
      sled.fakeX = (sled.fakeX || 0) + sled.velocity;

      // Transition trigger
      if (sled.fakeX > TRANSITION_X) {
        scrolling = false;
      }
      //   }

      // ----------------------
      // PHASE 2: REAL MOVEMENT (NEAR CLIFF)
      // ----------------------
      if (!scrolling) {
        add([
          text("Finished!"),
          pos(width() / 2, height() / 2 - 50),
          anchor("center"),
          scale(2),
        ]);
        if (!sled.released) {
          sled.velocity += 2;
          sled.pos.x -= 8;
          sled.pos.y += sled.velocity;
          sled.angle -= 2;
        }

        // stop detection
        if (sled.velocity < 40) {
          allStopped = false;
        }
        if (sled.released && penguin.vy > 40 && !allStopped) {
          destroy(penguin);
          allStopped = true;
        }

        // cliff check
        if (sled.pos.x <= CLIFF_X) {
          sled.finished = true;
          sled.distanceToCliff = -1;
        }
      }

      // ----------------------
      // DISTANCE UI
      // ----------------------

      let distance;

      if (scrolling) {
        distance = Math.max(0, Math.floor(CLIFF_X - (sled.fakeX || 0)));
      } else {
        distance = Math.max(0, Math.floor(sled.pos.x - CLIFF_X));
      }

      const newText = `P${sled.playerNumber}: ${distance}`;

      if (distanceTexts[sled.playerNumber - 1].text !== newText) {
        distanceTexts[sled.playerNumber - 1].text = newText;
      }

      // distanceTexts[
      //   sled.playerNumber - 1
      // ].text = `P${sled.playerNumber}: ${distance}m`;
    });

    // ----------------------
    // END CONDITION
    // ----------------------
    if (!scrolling && allStopped) {
      players.forEach(({ sled }) => {
        if (!sled.finished) {
          sled.finished = true;
          sled.distanceToCliff = sled.pos.x - CLIFF_X;
        }
      });

      wait(3, () => {
        endGame();
      });
    }
  });
});

// ----------------------
// END GAME
// ----------------------
function endGame() {
  gameOver = true;

  let winner = null;
  let best = Infinity;

  players.forEach(({ sled }) => {
    if (sled.distanceToCliff >= 0 && sled.distanceToCliff < best) {
      best = sled.distanceToCliff;
      winner = sled.playerNumber;
    }
  });

  BG_SPEED = 0;

  go("result", { winner });
}

// ----------------------
// RESULT SCENE
// ----------------------
scene("result", ({ winner }) => {
  add([
    text(winner !== null ? `Player ${winner} Wins!` : "Everyone Fell!"),
    pos(width() / 2, height() / 2 - 50),
    anchor("center"),
    scale(2),
  ]);

  const btn = add([
    rect(200, 60),
    pos(width() / 2, height() / 2 + 60),
    anchor("center"),
    area(),
    color(0, 200, 0),
  ]);

  add([text("Replay"), pos(width() / 2, height() / 2 + 60), anchor("center")]);

  btn.onClick(() => go("game"));
});

// ----------------------
go("game");
