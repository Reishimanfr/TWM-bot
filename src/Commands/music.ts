import { ActionRowBuilder, ChatInputCommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder, StringSelectMenuBuilder, roleMention } from "discord.js";
import { Model } from "sequelize";
import { PlayerSettings as PlayerSettingsDb } from "../Models";
import Command from "../types/Command";

const NON_TOGGLE_OPTIONS = ['showConfig', 'djRoleId', 'voteSkipMembers', 'setVoteSkipThreshold']

const music: Command = {
  permissions: ['SendMessages'],
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Configure music player options to your liking'),

  async callback({ interaction }) {
    const optionsMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('options-select')
          .setOptions(
            {
              label: '⚙️ View config',
              description: 'Shows the current configuration of the player.',
              value: 'showConfig',
            },
            {
              label: '👋 Leave on queue end',
              description: 'Toggles if the bot should leave after a queue ends.',
              value: 'queueEndDisconnect',
            },
            {
              label: '⏩ Vote skipping',
              description: 'Toggles if skipping a song requires users to vote to skip.',
              value: 'voteSkipToggle',
            },
            {
              label: '↪️ Resend message after song end',
              description: 'Toggles if the bot should resend the now playing message on new track.',
              value: 'resendMessageOnEnd',
            },
            {
              label: '🔄 Dynamic now playing message',
              description: 'Toggles if the bot should update the now playing message every 15s.',
              value: 'dynamicNowPlaying',
            },
            {
              label: '❗Require DJ role',
              description: 'Toggles if members are required to have the DJ role to use commands.',
              value: 'requireDjRole',
            },
            {
              label: '✨ DJ role',
              description: 'Sets the role to be considered the "DJ role".',
              value: 'djRoleId',
            },
            {
              label: '🔢 Vote skipping member amount',
              description: 'Sets how many members must be in voice channel for voting to be enabled.',
              value: 'voteSkipMembers',
            },
            {
              label: '🔢 Vote skipping threshold (%)',
              description: 'Sets the % of members required to vote "yes" to skip a song.',
              value: 'setVoteSkipThreshold',
            }
          )
      )

    const res = await interaction.reply({
      content: 'Select a option for the music player you want to configure.',
      components: [optionsMenu],
      ephemeral: true
    })

    const collector = res.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000
    })

    collector.on('collect', async (collected) => {
      await collected.deferUpdate()
      collector.resetTimer()

      const optionName = collected.values[0]
      const optionLabel = collected.component.options.find(c => c.value === optionName)?.label
      const [record] = await PlayerSettingsDb.findOrCreate({
        where: { guildId: interaction.guildId },
      })

      if (!NON_TOGGLE_OPTIONS.includes(optionName)) {
        const toggledOption = !record.getDataValue(optionName)

        await PlayerSettingsDb.update({
          [optionName]: toggledOption
        }, { where: { guildId: interaction.guildId } })

        await interaction.followUp({
          content: `**${optionLabel}** toggled to **${toggledOption}**`,
          ephemeral: true
        })

        return
      }

      switch (optionName) {
        case 'djRoleId': await setDjRole(interaction); break;
        case 'voteSkipMembers': await setVoteSkipMembers(interaction); break
        case 'voteSkipThreshold': await setVoteSkipThreshold(interaction); break;
        case 'showConfig': await showConfig(interaction, record); break;
      }
    })

    collector.on('end', (_) => {
      interaction.editReply({
        components: [],
        content: 'This interaction has expired.'
      })
    })
  }
}

async function setDjRole(interaction: ChatInputCommandInteraction) {
  await interaction.editReply({
    content: 'Mention the role you\'d like to set as the DJ role.'
  })

  const awaitRole = await interaction.channel?.awaitMessages({
    max: 1,
    time: 60000,
    filter: (msg) => msg.author.id === interaction.user.id
  })

  const message = awaitRole?.at(0)
  if (!message) return

  let correctRole = ''

  const mention = message.mentions.roles.at(0)

  if (mention) {
    correctRole = mention.id
  } else {
    const roleId = message.content.trim().split(' ')[0]

    const isValidRole = await interaction.guild?.roles.fetch(roleId)
      .catch(() => undefined)

    if (!isValidRole) {
      interaction.editReply('This doesn\'t seem to be a valid role ID.')
      return
    }

    correctRole = roleId
  }

  await PlayerSettingsDb.update({
    djRoleId: correctRole
  }, { where: { guildId: interaction.guildId } })

  await interaction.editReply({
    content: `New DJ role set to ${roleMention(correctRole)}!`
  })
}

async function setVoteSkipMembers(interaction: ChatInputCommandInteraction) {
  await interaction.editReply({
    content: 'Input a new member requirement for vote skips to occur.'
  })

  const awaitAmount = await interaction.channel?.awaitMessages({
    max: 1,
    time: 60000,
    filter: (msg) => msg.author.id === interaction.user.id
  })

  const rawAmount = awaitAmount?.at(0)
  if (!rawAmount) return

  const newAmount = Number(rawAmount.content)

  if (isNaN(newAmount)) {
    await interaction.editReply({
      content: 'The provided value is not a valid number.'
    })
    return
  }

  await PlayerSettingsDb.update({
    voteSkipMembers: newAmount
  }, { where: { guildId: interaction.guildId } })

  await interaction.editReply({
    content: `New member requirement set to **${newAmount} members**!`
  })
}

async function setVoteSkipThreshold(interaction: ChatInputCommandInteraction) {
  await interaction.editReply({
    content: 'Input a new voting threshold for vote skips to be accepted.'
  })

  const awaitAmount = await interaction.channel?.awaitMessages({
    max: 1,
    time: 60000,
    filter: (msg) => msg.author.id === interaction.user.id
  })

  const rawAmount = awaitAmount?.at(0)
  if (!rawAmount) return

  const newAmount = Number(rawAmount.content)

  if (isNaN(newAmount)) {
    await interaction.editReply({
      content: 'The provided value is not a valid number.'
    })
    return
  }

  await PlayerSettingsDb.update({
    voteSkipThreshold: newAmount
  }, { where: { guildId: interaction.guildId } })

  await interaction.editReply({
    content: `New vote skip threshold set to **${newAmount}%**!`
  })
}

async function showConfig(interaction: ChatInputCommandInteraction, record: Model<any, any>) {
  const data = record.dataValues

  const isEnabled = (bool: boolean) => bool ? '✅' : '❌'

  const configEmbed = new EmbedBuilder()
    .setAuthor({
      name: `Music player configuration • ${interaction.guild?.name}`,
      iconURL: interaction.guild?.iconURL() ?? undefined
    })
    .setDescription(`### DJ role
Enabled: \`${isEnabled(data.requireDjRole)}\`
Role: ${roleMention(data.djRoleId)}
### Skipvote
Enabled: \`${isEnabled(data.voteSkipToggle)}\`
Required members: \`${data.voteSkipMembers} members\`
Voting threshold: \`${data.voteSkipThreshold}% members\`
### Other options
Disconnect on queue end: \`${isEnabled(data.queueEndDisconnect)}\`
Resend message on new track: \`${isEnabled(data.resendMessageOnEnd)}\`
Update now playing message: \`${isEnabled(data.dynamicNowPlaying)}\``)

  interaction.editReply({
    embeds: [configEmbed]
  })
}

export default music