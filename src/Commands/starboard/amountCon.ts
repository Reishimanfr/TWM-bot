import { CommandInteraction, ComponentType, EmbedBuilder } from "discord.js";
import { Model } from "sequelize";
import { starboardConfig } from "../../Helpers/DatabaseSchema";
import util from "../../Helpers/Util";
import { confirmButtons, finalConButtons } from "./stUtil";

export default async function amountCon(
  interaction: CommandInteraction,
  record: Model<any, any>
) {
  const oldAmount = record.getDataValue("amount");

  const embeds = [
    new EmbedBuilder()
      .setDescription(
        `[ The current amount of required emojis is set to **${oldAmount}**. ]`
      )
      .setColor(util.embedColor),

    new EmbedBuilder()
      .setDescription(`[ Sure! The amount will stay the same. ]`)
      .setColor(util.embedColor),

    new EmbedBuilder()
      .setDescription(`[ Input the new amount of required reactions here... ]`)
      .setColor(util.embedColor),

    new EmbedBuilder()
      .setDescription(`[ The amount must be a number! ]`)
      .setColor(util.embedColor),
  ];

  const res = await interaction.editReply({
    embeds: [embeds[0]],
    components: [confirmButtons],
  });

  const collector = await res.awaitMessageComponent({
    componentType: ComponentType.Button,
    time: 60000,
  });

  await collector.deferUpdate();
  const value = collector.customId;

  if (value == "deny") {
    return interaction.editReply({
      embeds: [embeds[1]],
      components: [],
    });
  }

  await interaction.editReply({
    embeds: [embeds[2]],
    components: [],
  });

  const sel = await interaction.channel?.awaitMessages({
    max: 1,
    time: 60000,
    filter: (u) => u.author.id === interaction.user.id, // Only accept messages from the command initiator
  });

  const content = sel?.at(0)?.content;

  if (!content) return;

  const parseAmount = parseInt(content);

  // Amount input is not valid number
  if (isNaN(parseAmount)) {
    return interaction.editReply({
      embeds: [embeds[3]],
    });
  }

  interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setDescription(
          `[ Done! The new amount has been set to **${parseAmount}**. ]`
        )
        .setColor(util.embedColor),
    ],
    components: [],
  });

  await starboardConfig.update(
    {
      amount: parseAmount,
    },
    { where: { guildId: interaction.guildId } }
  );
}
