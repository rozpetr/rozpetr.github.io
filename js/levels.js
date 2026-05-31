"use strict";
/* Level data. Geometry in grid cells (W=100, H=72).

   DESIGN: the ice sits in a POCKET fully enclosed by fixed insulator walls
   except for a MOUTH. A heater hugs the mouth, a few air cells away. Because the
   walls block every bypass path, heat can only reach the ice THROUGH the mouth,
   so plugging the mouth is decisive: left open the cube melts; sealed it survives.
   Short heater->ice distances also ensure the heat front arrives within the timer
   (diffusion length ~ sqrt(alpha*t)). Validated headlessly in validate.js. */

function rect(x,y,w,h){ return {x,y,w,h}; }

const LEVELS = [
  {
    name:"Block the Heat",
    timer:55, need:0.25,
    heaters:[ rect(10,30,4,12) ],                                  // burner at the mouth
    walls:[ rect(48,26,24,4), rect(48,42,24,4), rect(68,26,4,20) ],// pocket: top, bottom, right
    ice:   rect(48,30,20,12),                                      // cube inside; mouth (4-cell gap) faces left
    tools:[ {type:INSUL, w:4, h:12, count:10, name:"Insulator", desc:"Blocks heat flow"} ],
    hint:"The cube's shelter has one open mouth, right at the flame. Drop the insulator into the gap to seal it in."
  },
  {
    name:"Two Fires",
    timer:48, need:0.25,
    heaters:[ rect(42,22,16,4), rect(42,52,16,4) ],                // burners at top & bottom mouths
    walls:[ rect(38,28,4,20), rect(58,28,4,20) ],                  // pocket side walls; mouths open top & bottom
    ice:   rect(42,32,16,12),
    tools:[
      {type:INSUL,  w:16, h:4, count:2, name:"Insulator", desc:"Blocks heat flow"},
      {type:COOLER, w:8,  h:8, count:1, name:"Cooler",    desc:"Active heat sink"}
    ],
    hint:"One flame above, one below. Cap BOTH mouths with the two insulator bars (the cooler is spare margin)."
  },
  {
    name:"Heat Leak",
    timer:54, need:0.50,
    heaters:[ rect(40,16,20,4) ],                                  // wide burner over a wide top mouth
    walls:[ rect(36,22,4,24), rect(60,22,4,24), rect(36,42,28,4) ],// U-pocket: left, right, bottom (open top)
    ice:   rect(40,26,20,16),                                      // mouth is 20 cells wide
    tools:[
      {type:INSUL,  w:12, h:4, count:1, name:"Insulator", desc:"Covers only part of the wide mouth"},
      {type:COOLER, w:8,  h:4, count:1, name:"Cooler",    desc:"Active heat sink; caps the rest"}
    ],
    hint:"Save half the cube. The insulator covers only 12 of the 20-cell mouth — set the cooler beside it to seal the rest."
  }
];
