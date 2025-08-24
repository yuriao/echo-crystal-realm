import { CHARACTERS } from '../constants/story';
import { createMessage, MESSAGE_TYPES } from '../utils/messageTypes';

export const getIntroMessages = () => {
  const messages = [
    {
      type: MESSAGE_TYPES.IMAGE,
      sender: CHARACTERS.NARRATOR,
      content: 'https://picsum.photos/400/300', // Placeholder realm image
    },
    {
      type: MESSAGE_TYPES.TEXT,
      sender: CHARACTERS.NARRATOR,
      content: 'Welcome, traveler. You have awakened in the Crystal Realm, a place where ancient magic flows through every living thing.',
    },
    {
      type: MESSAGE_TYPES.TEXT,
      sender: CHARACTERS.ELARA,
      content: 'Greetings, young one. I am Elara, Sage of the Ethereal Winds. I sense great potential within you.',
    },
    {
      type: MESSAGE_TYPES.TEXT,
      sender: CHARACTERS.BRAMBLE,
      content: 'Hey there! Name\'s Bramble, Guardian of the Living Wood. Don\'t let Elara\'s fancy talk scare you - we\'re here to help!',
    },
    {
      type: MESSAGE_TYPES.TEXT,
      sender: CHARACTERS.KAEL,
      content: 'I am Kael, Keeper of Ancient Runes. The crystals have chosen you for a reason. What questions burn in your mind?',
    },
  ];

  return messages.map((msg, index) => ({
    ...createMessage(msg.type, msg.sender, msg.content, 0),
    id: `intro-${index}`,
  }));
};