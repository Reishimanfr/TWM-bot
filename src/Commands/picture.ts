import axios from 'axios';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder
} from 'discord.js';
import { embedColor } from '../Helpers/Util';
import Command from '../types/Command';

async function getImage(link: string) {
  const request = await axios.get(link);
  const data = request.data;

  return data.image || data.data.url; // Depending on which api we're using
}

const picture: Command = {
  permissions: ['SendMessages', 'AttachFiles'],
  data: new SlashCommandBuilder()
    .setName('picture')
    .setDescription('Get a random picture of a selected animal')
    .addStringOption((animal) =>
      animal
        .setName('animal')
        .setDescription('Animal of your choosing')
        .addChoices(
          { name: 'Bird', value: 'bird' },
          { name: 'Cat', value: 'cat' },
          { name: 'Capybara', value: 'capybara' },
          { name: 'Dog', value: 'dog' },
          { name: 'Fox', value: 'fox' },
          { name: 'Kangaroo', value: 'kangaroo' },
          { name: 'Koala', value: 'koala' },
          { name: 'Panda', value: 'panda' },
          { name: 'Raccoon', value: 'raccoon' },
          { name: 'Red Panda', value: 'red_panda' }
        )
        .setRequired(true)
    )
    .addBooleanOption((secret) =>
      secret
        .setName('secret')
        .setDescription('Should you be the only one seeing the command reply?')
    ),

  helpPage: new EmbedBuilder()
    .setDescription('Sends cute pictures of a selected animal')
    .addFields(
      {
        name: 'Options',
        value: `* \`Animal\` -> A animal to show pictures of.
* \`Secret\` -> Toggles if only you should see the reply`
      },
      {
        name: 'Returns',
        value: 'A picture of the selected animal in PNG format.'
      },
      {
        name: 'Notes',
        value: 'You can use the 🔄️ button to get another picture more quickly instead of sending the command again.'
      }
    )
    .setImage('https://cdn.discordapp.com/attachments/1169390259411369994/1175081409497534534/image.png'),

  callback: async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;

    const choice = interaction.options.getString('animal');
    const secret = interaction.options.getBoolean('secret') ?? false;

    // Depending on the choice prepare the link to be used in the getImage function
    const link: string =
      choice === 'capybara'
        ? 'https://api.capy.lol/v1/capybara?json=true'
        : `https://some-random-api.com/animal/${choice}`;

    const image = await getImage(link);

    const embed = new EmbedBuilder()
      .setImage(image) // Get and set the image
      .setColor(embedColor);

    // The reason we use a array is so we can edit the .setDisabled value of the button once the interaction expires
    const components = [
      new ButtonBuilder()
        .setCustomId('get-another')
        .setLabel('🔃')
        .setStyle(ButtonStyle.Secondary),
    ];

    const enabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      components
    );

    const reply = await interaction.reply({
      embeds: [embed],
      components: [enabledRow],
      ephemeral: secret,
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on('collect', async (button) => {
      await button.deferUpdate();
      collector.resetTimer();

      const image = await getImage(link);

      const newEmbed = new EmbedBuilder()
        .setImage(image) // Get set image
        .setColor(embedColor);

      try {
        await reply.edit({ embeds: [newEmbed] });
      } catch { }
    });

    collector.on('end', async (_) => {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        components[0].setDisabled(true)
      );

      try {
        await reply.edit({ components: [disabledRow] });
      } catch { }
    });
  },
}

export default picture