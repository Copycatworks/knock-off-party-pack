// Questions for Ego Check. Every question is { prompt, options }, plus
// correctIndex for trivia. Trivia answers are listed first and shuffled in.
import { randomInt } from '../random.js';

const YES_NO = [
  'Have you ever eaten food off the floor?',
  'Do you sing in the shower?',
  'Have you ever pretended to be sick to skip something?',
  'Do you sleep with socks on?',
  'Have you ever cried at a movie?',
  'Do you talk to your pets like they’re people?',
  'Have you ever forgotten someone’s name right after hearing it?',
  'Do you put pineapple on pizza?',
  'Have you ever waved back at someone who wasn’t waving at you?',
  'Do you read the last page of a book first?',
  'Have you ever broken a bone?',
  'Do you check your phone as soon as you wake up?',
  'Have you ever been on TV?',
  'Do you believe in ghosts?',
  'Have you ever laughed so hard you snorted?',
  'Do you still sleep with a stuffed animal?',
  'Have you ever re-gifted a present?',
  'Can you whistle with your fingers?',
  'Have you ever walked into a glass door?',
  'Do you eat cereal with the milk poured first?',
  'Have you ever stayed up all night?',
  'Do you know all the words to your national anthem?',
  'Have you ever lied about your age?',
  'Would you eat a bug for $100?',
];

const TRIVIA = [
  { prompt: 'What is the largest planet in our solar system?', options: ['Jupiter', 'Saturn', 'Neptune', 'Earth'] },
  { prompt: 'How many legs does a spider have?', options: ['8', '6', '10', '12'] },
  { prompt: 'What is the capital of Australia?', options: ['Canberra', 'Sydney', 'Melbourne', 'Perth'] },
  { prompt: 'Which animal is the tallest?', options: ['Giraffe', 'Elephant', 'Moose', 'Camel'] },
  { prompt: 'What color do you get by mixing blue and yellow?', options: ['Green', 'Purple', 'Orange', 'Brown'] },
  { prompt: 'How many minutes are in a day?', options: ['1,440', '1,200', '2,400', '3,600'] },
  { prompt: 'Which ocean is the largest?', options: ['Pacific', 'Atlantic', 'Indian', 'Arctic'] },
  { prompt: 'Who painted the Mona Lisa?', options: ['Leonardo da Vinci', 'Michelangelo', 'Van Gogh', 'Picasso'] },
  { prompt: 'What is the hardest natural substance?', options: ['Diamond', 'Gold', 'Iron', 'Quartz'] },
  { prompt: 'How many sides does a hexagon have?', options: ['6', '5', '7', '8'] },
  { prompt: 'Which planet is known as the Red Planet?', options: ['Mars', 'Venus', 'Mercury', 'Jupiter'] },
  { prompt: 'What is the main ingredient in guacamole?', options: ['Avocado', 'Lime', 'Tomato', 'Pepper'] },
  { prompt: 'Which country gave the Statue of Liberty to the USA?', options: ['France', 'England', 'Spain', 'Italy'] },
  { prompt: 'What gas do plants take in from the air?', options: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium'] },
  { prompt: 'How many players are on a soccer team on the field?', options: ['11', '9', '10', '12'] },
  { prompt: 'What is the smallest prime number?', options: ['2', '1', '3', '0'] },
  { prompt: 'Which bird is a symbol of peace?', options: ['Dove', 'Eagle', 'Swan', 'Owl'] },
  { prompt: 'What is the freezing point of water in Fahrenheit?', options: ['32°', '0°', '100°', '212°'] },
  { prompt: 'Which instrument has 88 keys?', options: ['Piano', 'Organ', 'Accordion', 'Harp'] },
  { prompt: 'What is the longest river in the world?', options: ['Nile', 'Amazon', 'Mississippi', 'Yangtze'] },
  { prompt: 'How many hearts does an octopus have?', options: ['3', '1', '2', '8'] },
  { prompt: 'What language has the most native speakers?', options: ['Mandarin Chinese', 'English', 'Spanish', 'Hindi'] },
  { prompt: 'Which metal is liquid at room temperature?', options: ['Mercury', 'Lead', 'Tin', 'Aluminum'] },
  { prompt: 'In which continent is Egypt?', options: ['Africa', 'Asia', 'Europe', 'Middle East'] },
];

const PICK_ONE = [
  { prompt: 'Pick a dinner.', options: ['Pizza', 'Tacos', 'Sushi'] },
  { prompt: 'Pick a superpower.', options: ['Flying', 'Invisibility', 'Mind reading'] },
  { prompt: 'Pick a vacation.', options: ['Beach', 'Mountains', 'Big city'] },
  { prompt: 'Pick a pet.', options: ['Dog', 'Cat', 'Goldfish'] },
  { prompt: 'Pick a season.', options: ['Summer', 'Winter', 'Fall'] },
  { prompt: 'Pick a breakfast.', options: ['Pancakes', 'Eggs & bacon', 'Cereal'] },
  { prompt: 'Pick a movie night.', options: ['Horror', 'Comedy', 'Action'] },
  { prompt: 'Pick a way to travel.', options: ['Plane', 'Train', 'Road trip'] },
  { prompt: 'Pick a dessert.', options: ['Ice cream', 'Cake', 'Cookies'] },
  { prompt: 'Pick a time of day.', options: ['Early morning', 'Afternoon', 'Late night'] },
  { prompt: 'Pick a drink.', options: ['Coffee', 'Tea', 'Soda'] },
  { prompt: 'Pick a place to live.', options: ['Castle', 'Treehouse', 'Spaceship'] },
  { prompt: 'Pick a weekend.', options: ['Party', 'Nap all day', 'Adventure'] },
  { prompt: 'Pick a sidekick.', options: ['Robot', 'Dragon', 'Talking cat'] },
  { prompt: 'Pick a game.', options: ['Board games', 'Video games', 'Sports'] },
  { prompt: 'Pick a snack.', options: ['Chips', 'Popcorn', 'Fruit'] },
  { prompt: 'Pick a job for a day.', options: ['Astronaut', 'Chef', 'Rock star'] },
  { prompt: 'Pick a weather.', options: ['Sunny', 'Rainy', 'Snowy'] },
  { prompt: 'Pick a party.', options: ['Karaoke', 'Dance', 'Game night'] },
  { prompt: 'Pick a fear to lose.', options: ['Spiders', 'Heights', 'The dark'] },
  { prompt: 'Pick a music style.', options: ['Pop', 'Rock', 'Hip-hop'] },
  { prompt: 'Pick a gift.', options: ['Money', 'A surprise', 'Something homemade'] },
  { prompt: 'Pick an era to visit.', options: ['Dinosaurs', 'Ancient Egypt', 'The future'] },
  { prompt: 'Pick a theme park ride.', options: ['Roller coaster', 'Ferris wheel', 'Haunted house'] },
];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `count` different questions for a round type: 'yesno', 'trivia' or 'pick'. */
export function buildRound(type, count) {
  if (type === 'yesno') return shuffle(YES_NO).slice(0, count).map((prompt) => ({ prompt, options: ['Yes', 'No'] }));
  if (type === 'pick') return shuffle(PICK_ONE).slice(0, count).map((q) => ({ ...q }));
  return shuffle(TRIVIA).slice(0, count).map(({ prompt, options }) => {
    const shuffled = shuffle(options);
    return { prompt, options: shuffled, correctIndex: shuffled.indexOf(options[0]) };
  });
}
