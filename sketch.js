window.addEventListener('click', async ()=> {
  await Tone.start();
}, {once : true});


let numNodes = 5;
let snodes = [];
let flyer;

let noice = new noiseSource();

let selected = null;

function setup() {
  createCanvas(400, 400);

  for (let i = 0; i < numNodes; i++) {
    snodes.push(
      new springNode({
        posX: random(width),
        posY: random(height / 2),
        isAnchored: true,
      })
    );
  }

  for (let i = 0; i < 3; i++) {
    snodes.push(
      new springNode({
        posX: random(width),
        posY: random(height),
        fillCol: { r: 220, g: 90, b: 30 },
        strokeCol: { r: 50, g: 189, b: 200 },
        size: 50,
      })
    );
  }

  flyer = new fly({ posX: width / 2, posY: height / 2, size: 100 });
}

function draw() {
  background(40, 37, 47);

  noFill();
  ellipse(mouseX, mouseY, 80, 80);
  if (selected != null) selected.setPos(mouseX, mouseY);

  for (let sn of snodes) sn.update();
  for (let sn of snodes) sn.render();

  if (random(10) < 1)
    flyer.addForce(createVector(random(-2, 2), random(-2, 2)));
  flyer.update();
  flyer.render();
}

function mousePressed() {
  for (let sn of snodes) {
    if (sn.checkCollide(mouseX, mouseY, 40)) {
      //select object
      selected = sn;
    }
  }
}

function touchStarted() {
  for (let sn of snodes) {
    if (sn.checkCollide(mouseX, mouseY, 40)) {
      //select object
      selected = sn;
    }
  }
}

function mouseReleased() {
  //release object
  if (selected != null) selected.addForce(selected.getDeltaPos().mult(-0.05));
  selected = null;
}

function touchEnded() {
  //release object
  if (selected != null) selected.addForce(selected.getDeltaPos().mult(-0.05));
  selected = null;
}

function keyPressed() {
  for (let sn of snodes)
    sn.addForce(createVector(random(-2, 2), random(-2, 2)));
}

function fly(_params) {
  let pos = createVector(_params.posX, _params.posY);
  let vel = createVector(0, 0);
  let acc = createVector(0, 0);
  let friction = _params.friction || 0.95;
  let size = _params.size || 40;
  let edgeWrapping = _params.edgeWrapping || true;

  let trig = false;

  this.update = function () {
    vel.add(acc);
    vel.mult(friction);
    acc.set(0, 0);
    pos.add(vel);

    //Wrap edges
    if (edgeWrapping) {
      if (pos.x > width) pos.x = 0;
      if (pos.x < 0) pos.x = width;
      if (pos.y > width) pos.y = 0;
      if (pos.y < 0) pos.y = width;
    }

    if (random(1000) < 30) {
      trig = true;
      setTimeout(() => {
        trig = false;
      }, 100);
      for (let sn of snodes) {
        if (sn.checkCollide(pos.x, pos.y, size / 2)) {
          sn.addForce(createVector(random(-3, 3), random(-3, 3)));
        }
      }
    }
  };

  this.render = function () {
    if (trig) fill(255);
    else noFill();

    ellipse(pos.x, pos.y, size, size);
  };

  this.addForce = function (_force) {
    acc.add(_force);
  };
}

function springNode(_params) {
  //Physics vars
  if (_params.posX == undefined) _params.posX = width / 2;
  if (_params.posY == undefined) _params.posY = height / 2;
  let isAnchored = _params.isAnchored || false;
  let restPos = createVector(_params.posX, _params.posY);
  let springForce = _params.springForce || 0.2;
  let pos = createVector(_params.posX, _params.posY);
  let vel = createVector(0, 0);
  let acc = createVector(0, 0);
  let friction = _params.friction || 0.95;
  let edgeWrapping = _params.edgeWrapping || false;

  //Optimization / PhysData
  let velResetThresh = _params.velResetThresh || 0.01;
  let posBuffer = createVector(0, 0);
  let deltaPos = createVector(0, 0);
  let maxDisplacement = _params.maxDisplacement || 50;
  let res = _params.res || 4;
  let fc = 0;

  //Sound Generator
  let sounder = new filterBank();
  sounder.setInput(noice.noise);

  //Rendering
  let fillCol = _params.fillCol || { r: 50, g: 189, b: 200 };
  let strokeCol = _params.strokeCol || { r: 250, g: 100, b: 200 };
  let size = _params.size || 30;

  this.update = function () {
    fc++;

    vel.add(acc);
    vel.mult(friction);
    acc.set(0, 0);
    pos.add(vel);

    //Quantize velocity to 0 if under thresh to avoid calulating tiny vals
    if (vel.mag() < velResetThresh) vel.set(0, 0);

    //Calc delta position
    deltaPos = posBuffer.sub(pos);
    posBuffer = pos.copy();

    //Sound Logic
    if (!isAnchored) {
      let l = Math.min(deltaPos.mag() / 4, 0.8);
      if (fc % res == 0) sounder.setLevel(l, 0.1);
    }

    //Wrap edges (doesn't work with spring logic)
    if (edgeWrapping && !isAnchored) {
      if (pos.x > width) pos.x = 0;
      if (pos.x < 0) pos.x = width;
      if (pos.y > width) pos.y = 0;
      if (pos.y < 0) pos.y = width;
    }

    //Springy
    if (!isAnchored) return;

    if (pos.x != restPos.x || pos.y != restPos.y) {
      const diff = pos.copy().sub(restPos.copy());

      if (diff.mag() < 0.1 && vel.mag() < 0.3) {
        pos = restPos.copy();
        vel.set(0, 0);
        //console.log("quantised stop");
        sounder.setLevel(0, 0.3);
        return;
      }

      const forceDir = pos.copy().sub(restPos.copy()).normalize();
      this.addForce(forceDir.mult(-springForce).mult(diff.mag()));

      //Sound Logic
      const lev = (forceDir.mag() + vel.mag()) / 2;
      if (fc % res == 0) sounder.setLevel(map(lev, 0, 20, 0, 1));
    }
  };

  this.render = function () {
    //noFill();
    strokeWeight(3);
    stroke(strokeCol.r, strokeCol.g, strokeCol.b);

    //ellipse(restPos.x, pos.y - (pos.y - height) /2, 10 , 10)
    noFill();
    beginShape();
    curveVertex(pos.x + 20, pos.y);
    curveVertex(pos.x, pos.y);
    curveVertex(restPos.x, pos.y - (pos.y - height) / 2);
    curveVertex(restPos.x, height);
    curveVertex(restPos.x + 100, height);
    endShape();

    fill(fillCol.r, fillCol.g, fillCol.b);
    ellipse(pos.x, pos.y, size, size);
  };

  this.addForce = function (_force) {
    acc.add(_force);
  };

  this.checkCollide = function (_x, _y, _r) {
    if (_r == undefined) _r = 0;
    if (p5.Vector.dist(createVector(_x, _y), pos) < size / 2 + _r) return true;
    return false;
  };

  this.setPos = function (_x, _y) {
    if (
      isAnchored &&
      p5.Vector.dist(createVector(_x, _y), pos) > maxDisplacement
    )
      return;
    pos.x = _x;
    pos.y = _y;
  };

  this.getDeltaPos = function () {
    return deltaPos;
  };
}

function filterBank() {
  let inputGain = new Tone.Gain(0);

  const env = new Tone.Envelope({
    attack: 0.1,
    decay: 0.2,
    sustain: 0.5,
    release: 0.8,
  }); //.connect(inputGain.gain);

  let outputGain = new Tone.Gain();
  outputGain.toDestination();

  let fb = [];
  let numFilters = 5;

  for (let i = 0; i < numFilters; i++) {
    let f = new Tone.Filter(random(50, 10000), "bandpass", -48);
    f.Q.value = 12;
    fb.push(f);
  }

  //inputGain.connect(fb[0]);
  for (let f of fb) {
    inputGain.connect(f);
    f.connect(outputGain);
  }

  this.setInput = function (_node) {
    _node.connect(inputGain);
  };

  this.trigger = function () {
    env.triggerAttackRelease(random(0.01, 0.1));
  };

  this.setLevel = function (_level, _time) {
    const t = _time || 0.05;
    inputGain.gain.rampTo(_level, t);
  };
}

function noiseSource() {
  this.noise = new Tone.Noise();
  this.noise.start();
}

//Integrate steering behavior to flyer
//Plant grows from seed, grow roots to different frequencies to make the plant sound
//More types of plants
//Genetic algorithm
