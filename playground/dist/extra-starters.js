// More small projects to read, run, and make your own.
export const extraStarters = [
  {
    "id": "sleepy-cat",
    "name": "Sleepy cat",
    "category": "Drawing",
    "description": "Build a cozy cat with circles and triangles. Try new fur colors.",
    "code": "background(\"#fff3e6\")\nwidth(3)\ncolor(\"#8b4b32\")\nfill(\"coral\")\ngo_to(-65, 85)\npolygon(3, 55)\ngo_to(65, 85)\npolygon(3, 55)\ngo_to(0, 0)\ncircle(110)\ngo_to(-43, 18)\nrectangle(38, 5)\ngo_to(43, 18)\nrectangle(38, 5)\ncolor(\"pink\")\ngo_to(0, -18)\ndot(22)\ncolor(\"#8b4b32\")\nwidth(2)\nfor side in [-1, 1]\n    repeat 3 as whisker\n        home()\n        go_to(side * 32, -10 - whisker * 12)\n        turn(side * 90)\n        move(65)\n    end\nend\nsay \"Shhh... the cat is sleeping.\"\n"
  },
  {
    "id": "rocket-trip",
    "name": "Rocket to the moon",
    "category": "Drawing",
    "description": "Draw a colorful rocket in space. Add planets or change its window size.",
    "code": "background(\"#152442\")\nrepeat 18\n    go_to(random(-220, 220), random(-220, 220))\n    color(\"white\")\n    dot(4)\nend\ncolor(\"orange\")\nfill(\"gold\")\ngo_to(0, -125)\nturn(180)\npolygon(3, 65)\nhome()\ncolor(\"#264b68\")\nfill(\"coral\")\ngo_to(-58, -65)\npolygon(3, 55)\ngo_to(58, -65)\npolygon(3, 55)\nfill(\"white\")\ngo_to(0, 0)\nrectangle(95, 180)\nfill(\"coral\")\ngo_to(0, 115)\npolygon(3, 65)\nfill(\"skyblue\")\ngo_to(0, 30)\ncircle(29)\ncolor(\"gold\")\ngo_to(160, 165)\ndot(50)\nsay \"Where will your rocket go?\"\n"
  },
  {
    "id": "aquarium",
    "name": "Tiny aquarium",
    "category": "Drawing",
    "description": "Use a function to draw three fish. Add a fourth fish with a new color.",
    "code": "function fish(x, y, shade)\n    home()\n    color(shade)\n    fill(shade)\n    go_to(x - 40, y)\n    turn(90)\n    polygon(3, 28)\n    home()\n    go_to(x, y)\n    circle(35)\n    color(\"white\")\n    go_to(x + 14, y + 10)\n    dot(14)\n    color(\"navy\")\n    dot(6)\nend\nbackground(\"#dff4fa\")\ncolor(\"gold\")\nfill(\"gold\")\ngo_to(0, -210)\nrectangle(500, 80)\nfish(-100, 100, \"coral\")\nfish(90, 0, \"purple\")\nfish(-70, -100, \"orange\")\ncolor(\"teal\")\nno_fill()\nrepeat 9\n    go_to(random(-200, 200), random(-140, 200))\n    circle(8)\nend\nsay \"Try adding another fish!\"\n"
  },
  {
    "id": "ice-cream",
    "name": "Triple scoop",
    "category": "Drawing",
    "description": "Stack three scoops on a cone. Change the flavors by choosing new colors.",
    "code": "background(\"#f7f2ff\")\ncolor(\"#a66b32\")\nfill(\"#eab975\")\ngo_to(0, -100)\nturn(180)\npolygon(3, 105)\nhome()\nflavors = [\"pink\", \"#b58b6d\", \"#c8edc4\"]\nrepeat 3 as scoop\n    color(flavors[scoop - 1])\n    go_to(0, scoop * 66 - 65)\n    dot(135)\nend\ncolor(\"coral\")\ngo_to(0, 185)\ndot(28)\nsay \"What are your three favorite flavors?\"\n"
  },
  {
    "id": "city-lights",
    "name": "City lights",
    "category": "Drawing",
    "description": "Nested loops fill a city with windows. Change the number of floors or the night colors.",
    "code": "background(\"#202841\")\nrepeat 5 as building\n    x = building * 85 - 255\n    floors = random(2, 5)\n    color(\"#485574\")\n    fill(\"#485574\")\n    go_to(x, floors * 25 - 175)\n    rectangle(65, floors * 50)\n    color(\"gold\")\n    fill(\"gold\")\n    repeat floors as floor\n        go_to(x - 14, floor * 50 - 200)\n        rectangle(12, 20)\n        go_to(x + 14, floor * 50 - 200)\n        rectangle(12, 20)\n    end\nend\ncolor(\"#fff3c4\")\ngo_to(160, 170)\ndot(50)\nsay \"A new skyline on every run.\"\n"
  },
  {
    "id": "patchwork",
    "name": "Patchwork quilt",
    "category": "Drawing",
    "description": "Two loops make a colorful grid. Try a new list of fabric colors.",
    "code": "background(\"#fcf7ed\")\ncolors = [\"coral\", \"gold\", \"teal\", \"purple\", \"skyblue\"]\nwidth(3)\ncolor(\"white\")\nrepeat 5 as row\n    repeat 5 as column\n        fill(colors[(row + column - 2) % 5])\n        go_to(column * 75 - 225, row * 75 - 225)\n        rectangle(70, 70)\n    end\nend\nsay \"Twenty-five squares from two little loops.\"\n"
  },
  {
    "id": "traffic-lights",
    "name": "Traffic lights",
    "category": "Animation",
    "description": "Switch from red to yellow to green. Use Quick pace and change how long each light stays on.",
    "code": "background(\"#eaf3ed\")\ncolors = [\"red\", \"gold\", \"green\"]\nrepeat 2\n    for light in [0, 1, 2]\n        clear()\n        color(\"#24382d\")\n        fill(\"#24382d\")\n        rectangle(110, 300)\n        repeat 3 as bulb\n            color(\"#596a60\")\n            go_to(0, 180 - bulb * 90)\n            dot(65)\n        end\n        color(colors[light])\n        go_to(0, 90 - light * 90)\n        dot(65)\n        wait(0.6)\n    end\nend\nsay \"Green means go!\"\n"
  },
  {
    "id": "sunrise",
    "name": "Little sunrise",
    "category": "Animation",
    "description": "Move the sun along a curved path. Use Quick pace, then try a slower sunrise.",
    "code": "background(\"#cbeaf7\")\nsun = sprite(\"circle\", \"gold\")\nrepeat 41 as frame\n    x = frame * 10 - 210\n    y = 140 - x * x / 160\n    place(sun, x, y)\n    wait(0.08)\nend\nsay \"A curve made from a little multiplication.\"\n"
  },
  {
    "id": "dice-duel",
    "name": "Dice duel",
    "category": "Game",
    "description": "Roll against Milo for three rounds. Read the conditions, then change the number of rounds.",
    "code": "score = 0\nshow_score(score)\nsay \"Roll against Milo!\"\nrepeat 3 as round\n    ask(\"Press Send answer to roll. \")\n    you = random(1, 6)\n    milo = random(1, 6)\n    say \"Round\", round, \"- you rolled\", you, \"and Milo rolled\", milo\n    if you > milo\n        score = score + 1\n        say \"You win this round!\"\n        play_note(72, 0.15)\n    else if you == milo\n        say \"A tie!\"\n    else\n        say \"Milo wins this round.\"\n    end\n    show_score(score)\nend\nsay \"You won\", score, \"rounds. Play again!\"\n"
  },
  {
    "id": "math-challenge",
    "name": "Addition adventure",
    "category": "Game",
    "description": "Answer five random addition questions. Try bigger numbers by changing the random bounds.",
    "code": "score = 0\nshow_score(score)\nrepeat 5\n    a = random(1, 9)\n    b = random(1, 9)\n    say \"What is\", a, \"+\", b, \"?\"\n    answer = number(ask(\"Your answer: \"))\n    if answer == a + b\n        score = score + 1\n        say \"Correct!\"\n        play_note(72, 0.1)\n    else\n        say \"The answer is\", a + b\n    end\n    show_score(score)\nend\nsay \"You got\", score, \"out of 5.\"\n"
  },
  {
    "id": "forest-story",
    "name": "The secret forest",
    "category": "Story",
    "description": "Choose a river or a hill and discover an ending. Add another question to extend your adventure.",
    "code": "name = ask(\"What is your explorer's name? \")\nsay name, \"found a path into a secret forest.\"\npath = lower(ask(\"Choose river or hill: \"))\nif path == \"river\"\n    say \"A little boat waits beside the river.\"\n    choice = lower(ask(\"Choose sail or stay: \"))\n    if choice == \"sail\"\n        say \"You sail to an island full of singing flowers!\"\n    else\n        say \"A friendly otter brings you a shiny pebble.\"\n    end\nelse if path == \"hill\"\n    say \"At the top, you find a telescope.\"\n    say \"Through it, you spot a castle in the clouds!\"\nelse\n    say \"You make your own path and discover a hidden garden.\"\nend\nsay \"The adventure continues... What happens next?\"\n"
  },
  {
    "id": "musical-stairs",
    "name": "Musical staircase",
    "category": "Music",
    "description": "Watch notes climb and play a scale. Change the note list to compose a different tune.",
    "code": "background(\"#f7f4eb\")\nsay \"Up the musical staircase!\"\nnotes = [60, 62, 64, 65, 67, 69, 71, 72]\ncolors = [\"coral\", \"orange\", \"gold\", \"green\", \"teal\", \"skyblue\", \"purple\", \"pink\"]\nrepeat 8 as step\n    color(colors[step - 1])\n    fill(colors[step - 1])\n    go_to(step * 48 - 216, step * 35 - 158)\n    rectangle(44, 30)\n    play_note(notes[step - 1], 0.25)\nend\nsay \"Try playing the notes in reverse.\"\n"
  }
];
