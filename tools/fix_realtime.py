from pathlib import Path

path = Path("js/main.js")
text = path.read_text(encoding="utf-8")

text = text.replace(
    "let running=false, finished=false, simTime=0;",
    """let running=false, finished=false, simTime=0;
let lastFrameMs = performance.now();
let physicsAccumulator = 0;
const REAL_STEP = 1 / 60;"""
)

text = text.replace(
    "function elapsedSeconds(){ return simTime/(TIME_PER_FRAME*60); }   // sim-units -> ~sec @60fps",
    "function elapsedSeconds(){ return simTime; }"
)

text = text.replace(
    "levelIndex=li; running=false; finished=false; simTime=0;",
    """levelIndex=li; running=false; finished=false; simTime=0;
  physicsAccumulator = 0;
  lastFrameMs = performance.now();"""
)

old_loop = """function loop(){
  if(running && !finished){
    step();
    simTime += TIME_PER_FRAME;
    const L=LEVELS[levelIndex];
    const remain=iceRemaining();
    if(remain<=0.001) finish(false);
    else if(elapsedSeconds()>=L.timer) finish(remain>=L.need);
  }
  render(drag,hover);
  refreshHUD();
  requestAnimationFrame(loop);
}"""

new_loop = """function loop(){
  const now = performance.now();
  let realDt = (now - lastFrameMs) / 1000;
  lastFrameMs = now;

  if(realDt > 0.25) realDt = 0.25;

  if(running && !finished){
    physicsAccumulator += realDt;

    while(physicsAccumulator >= REAL_STEP && running && !finished){
      step();
      simTime += REAL_STEP;
      physicsAccumulator -= REAL_STEP;

      const L=LEVELS[levelIndex];
      const remain=iceRemaining();

      if(remain<=0.001) finish(false);
      else if(elapsedSeconds()>=L.timer) finish(remain>=L.need);
    }
  }

  render(drag,hover);
  refreshHUD();
  requestAnimationFrame(loop);
}"""

if old_loop not in text:
    raise RuntimeError("old loop block was not found. open js/main.js and patch loop manually.")

text = text.replace(old_loop, new_loop)

path.write_text(text, encoding="utf-8")
print("main.js updated for real-time simulation")
