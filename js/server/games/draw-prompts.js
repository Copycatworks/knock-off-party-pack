// Characters for Memory Draw: ones most people could picture, but probably
// can't draw accurately from memory.
import { randomInt } from '../random.js';

export const CHARACTERS = [
  // Pokémon
  'Pikachu', 'Charmander', 'Squirtle', 'Bulbasaur', 'Jigglypuff', 'Snorlax', 'Psyduck', 'Eevee',
  // video games
  'Mario', 'Luigi', 'Sonic the Hedgehog', 'Pac-Man', 'Kirby', 'Donkey Kong', 'Yoshi', 'Link (Zelda)',
  // cartoons
  'SpongeBob SquarePants', 'Patrick Star', 'Mickey Mouse', 'Homer Simpson', 'Bart Simpson', 'Shrek',
  'Garfield', 'Snoopy', 'Hello Kitty', 'Scooby-Doo', 'Winnie the Pooh', 'Bugs Bunny', 'Peppa Pig',
  'Olaf (Frozen)', 'A Minion', 'Elmo', 'Cookie Monster', 'Kermit the Frog', 'Shaggy (Scooby-Doo)',
  // movies
  'Darth Vader', 'Yoda', 'Batman', 'Spider-Man', 'The Hulk', 'E.T.', 'Buzz Lightyear', 'Woody (Toy Story)',
  // brand mascots
  'Ronald McDonald', 'Tony the Tiger', 'The Michelin Man', 'Mr. Peanut', 'The Kool-Aid Man',
  'The Pillsbury Doughboy', 'Colonel Sanders', 'The Monopoly Man', 'The Geico Gecko', 'Chester Cheetah',
  // presidents and famous faces
  'Abraham Lincoln', 'George Washington', 'Barack Obama', 'Albert Einstein', 'Mr. Bean',
  'Dwayne "The Rock" Johnson', 'Keanu Reeves', 'Elvis Presley', 'Charlie Chaplin', 'The Mona Lisa',
];

/** `count` different characters in a random order. */
export function pickCharacters(count) {
  const list = [...CHARACTERS];
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, count);
}
