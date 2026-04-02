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
const TRANSITION_X = width() + 5000;

const ICE_FRICTION = 0.965;
const PULL_ACCEL = 0.3;
const MAX_SPEED = 8;

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
  const bg = add([sprite("skybg"), pos(0, 0), scale(5)]);

  const bga = add([sprite("ice"), pos(0, 0), scale(5)]);
  const bgb = add([sprite("ice"), pos(bga.width * -5, 0), scale(5)]);

  const bgc = add([sprite("float"), pos(0, 0), scale(5)]);
  const bgd = add([sprite("float"), pos(bgc.width * -5, 0), scale(5)]);

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
    if (!scrolling) return;

    BG_SPEED += 0.05;
    BG_SPEED = Math.min(BG_SPEED, 30);

    bg1.pos.x += BG_SPEED * 2;
    bg2.pos.x += BG_SPEED * 2;

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

    if (bga.pos.x + bga.width * 5 > bga.width * 5 * 2) {
      bga.pos.x = bga.pos.x - bga.width * 5;
    }
    if (bgb.pos.x + bgb.width * 5 > bgb.width * 5) {
      bgb.pos.x = bgb.pos.x - bgb.width * 5;
    }

    if (bgc.pos.x + bgc.width * 5 > bgc.width * 5 * 2) {
      bgc.pos.x = bgc.pos.x - bgc.width * 5;
    }
    if (bgd.pos.x + bgd.width * 5 > bgd.width * 5) {
      bgd.pos.x = bgd.pos.x - bgd.width * 5;
    }
  }

  // ----------------------
  // CLIFF
  // ----------------------
  const cliff = add([rect(20, height()), pos(CLIFF_X, 0), color(255, 0, 0)]);

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
      }
    });
  });

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
          penguin.vy += 0.5; // gravity
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
          sled.velocity += PULL_ACCEL;
          sled.pos.x -= 8;
          sled.pos.y += sled.velocity;
          sled.angle -= 2;
        } else {
          //   sled.velocity *= ICE_FRICTION;
          sled.velocity = 2;
        }

        // stop detection
        if (sled.velocity < 40) {
          allStopped = false;
        }
        if (sled.released && penguin.vy > 40) {
          allStopped = true;
        }

        // cliff check
        if (sled.pos.x <= CLIFF_X) {
          sled.finished = true;
          sled.distanceToCliff = -1;
        }
      }
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

      let wait = 3;
      loop(1, () => {
        wait--;
        if (wait < 0) {
          return;
        }
      });

      endGame();
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
