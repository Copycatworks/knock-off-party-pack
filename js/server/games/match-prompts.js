// Prompts for Match to Hatch. Good prompts have a few popular answers, so
// players have to guess what everyone else will say.
import { randomInt } from '../random.js';

export const PROMPTS = [
  'Name a round fruit.',
  'Who is the smartest president of the United States?',
  'Name a pizza topping.',
  'Name an animal with stripes.',
  'Name a color of the rainbow.',
  'Name a superhero.',
  'Name a breakfast food.',
  'Name a planet.',
  'Name something you find at the beach.',
  'Name a famous wizard.',
  'Name a sport played with a ball.',
  'Name an ice cream flavor.',
  'Name a dog breed.',
  'Name something that is yellow.',
  'Name a farm animal.',
  'Name a musical instrument.',
  'Name a vegetable kids hate.',
  'Name a board game.',
  'Name a Disney movie.',
  'Name something with wheels.',
  'Name a country in Europe.',
  'Name a famous painter.',
  'Name a holiday.',
  'Name something you do in the morning.',
  'Name a kitchen appliance.',
  'Name a candy bar.',
  'Name a video game character.',
  'Name something that flies.',
  'Name a month of the year.',
  'Name something people are afraid of.',
  'Name a fast food chain.',
  'Name a shape.',
  'Name a body part above the neck.',
  'Name a famous scientist.',
  'Name something you can drink.',
  'Name an animal in the ocean.',
  'Name a school subject.',
  'Name a job that wears a uniform.',
  'Name a type of weather.',
  'Name something that is cold.',
  'Name a number between 1 and 10.',
  'Name a famous ship.',
  'Name a thing in a bathroom.',
  'Name a bird that can’t fly.',
  'Name a card game.',
  'Name a type of tree.',
  'Name something with a lot of legs.',
  'Name a famous detective.',
  'Name a sandwich.',
  'Name the best day of the week.',
  'Name a dinosaur.',
  'Name a cartoon cat.',
  'Name something that is sticky.',
  'Name a type of pasta.',
  'Name a Halloween costume.',
];

/** All prompts in a random order. */
export function shuffledPrompts() {
  const list = [...PROMPTS];
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
