---
layout: post
title: About the game, and atomic layer deposition
---
Hello! If you have played with the little game on my homepage and wondered what it is, this post is for you. I want to explain what it simulates, how it works, and the technique behind it: [atomic layer deposition](https://en.wikipedia.org/wiki/Atomic_layer_deposition), or ALD.

## What is ALD?

ALD is a technique for depositing extremely thin films, about as thin as matter gets: a single atomic layer at a time. By repeating the deposition step, you build up thickness one layer per cycle, which gives you control at the atomic scale. To see why "one layer per cycle" is even possible, we need to look a little closer at the chemistry.

ALD grows out of [chemical vapor deposition](https://en.wikipedia.org/wiki/Chemical_vapor_deposition) (CVD). In CVD, two chemicals, one we call the precursor and the other the co-reactant, react spontaneously to form a solid. To keep that reaction in check, they are usually introduced into the chamber together, at low concentration and under vacuum. The trouble is that the reaction happens in the gas phase, throughout the chamber volume, so you get little control over how fast the film grows or how uniformly it covers the surface. Picture grinding black pepper over a pan: the spot right under the grinder gets a heavy dusting while the edges get almost none. CVD has the same problem with film thickness.

ALD solves this by splitting the reaction into a repeating cycle and forcing it to happen only on the surface. First you pulse in the precursor as a gas and let it stick to the surface. Then you purge the chamber with an inert gas that sweeps every last bit of leftover precursor out. Once the chamber is clear, you pulse in the co-reactant the same way, and purge again. That is one cycle.

Why does splitting it up work? Because of the chemistry. The precursor reacts only with a specific kind of surface site and ignores everything else, and crucially it does not react with itself. So when the precursor meets a reactive surface, it keeps reacting until every available site is occupied, and then it simply stops. Zoom in and you see exactly one atomic layer of precursor sitting on top. This is called a self-limiting reaction. The co-reactant behaves the same way: it reacts only with the layer of precursor that is already down, converts it into the final solid, and then stops, leaving a surface that is once again reactive toward the precursor. Repeat the cycle and, ideally, you add just one atomic layer each time.

Why does this matter, and why is ALD becoming more important? A big reason is that technology keeps shrinking. In semiconductors, for example, performance increasingly depends on controlling film thickness precisely and keeping the coating conformal (uniform over every surface, even down the walls of deep, narrow features), and ALD is the standout technique for exactly that. There are many other applications too; the [Wikipedia page](https://en.wikipedia.org/wiki/Atomic_layer_deposition) is a good place to explore them.

## Back to the game

The game is a minimalist simulation of ALD. It follows the self-limiting surface chemistry, the gas-phase physics, and the process engineering of a real cycle. One of the most famous ALD processes makes aluminum oxide (Al<sub>2</sub>O<sub>3</sub>) thin films, and I used that same chemistry as the model. The blue precursor stands in for trimethylaluminum (TMA), the yellow co-reactant is water (H<sub>2</sub>O), and the inert purge gas is argon (Ar). When TMA and water react in the right way, they form Al<sub>2</sub>O<sub>3</sub>.

As I mentioned, the reaction is supposed to happen on the surface. So if a purge is incomplete, leftover precursor and co-reactant can collide and react in the gas phase instead, giving you the unwanted CVD product: those red clusters. Your job is to zap the CVD clusters before they land and keep the film pure, growing it the ideal ALD way, blue reacting with a yellow surface, then yellow reacting with the blue surface, and so on, cycle after cycle.

Real ALD is, of course, far more involved than this, with many variants and subtleties. But I hope the game gives a feel for the basics, and for what I spend my days thinking about in my research.
