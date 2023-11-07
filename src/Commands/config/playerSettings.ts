import { ActionRowBuilder, ChatInputCommandInteraction, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { playerOverrides } from "../../Helpers/DatabaseSchema";
import { config as defaultConfig, PlayerSettings } from "../../config";
import { playerOptionsData } from "./_playerOptionDescriptions";

/**
 * This function combines the default config with the overrides a user may have added.
 * Example: if a setting has been overriden the property for it's key will be the overriden
 * one, if it wasn't it will be set to the default value.
 */
async function combineConfig(interaction: ChatInputCommandInteraction): Promise<PlayerSettings> {
  const overrides = await playerOverrides.findOne({ where: { guildId: interaction.guildId } })

  if (!overrides) return defaultConfig.player

  const data = overrides.dataValues
  // We don't need these properties
  delete data.id
  delete data.guildId

  for (const [key, value] of Object.entries(data)) {
    data[key] = value ?? defaultConfig.player
  }

  return data
}

function buildMenu(config: PlayerSettings): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu: StringSelectMenuOptionBuilder[] = [];

  for (const [key] of Object.entries(config)) {
    const currentOption = playerOptionsData[key]
    let emoji = '⚙️'

    if (currentOption.type == 'boolean') {
      emoji = config[key] ? '✅' : '❌'
    }

    const option = new StringSelectMenuOptionBuilder()
      .setLabel(currentOption.name ?? 'Missing name definition')
      .setDescription(currentOption.description ?? 'Missing description')
      .setValue(key)
      .setEmoji(emoji)

    menu.push(option)
  }

  return new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setOptions(menu)
        .setMaxValues(1)
        .setPlaceholder('Select a option to configure!')
        .setCustomId('test')
    )
}

export default async function playerSettings(interaction: ChatInputCommandInteraction) {
  const playerConfig = await combineConfig(interaction)
  const optionMenu = buildMenu(playerConfig)
  // Used to append messages to the end of the base content
  const baseContent = `:white_check_mark: -> This option is enabled. Clicking will disable it.
:x: -> This options is disabled. Clicking will enable it.
:gear: -> This option requires additional info to be configured.`

  const optionSelectMenu = await interaction.editReply({
    content: baseContent,
    components: [optionMenu],
  })

  const collector = optionSelectMenu.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    idle: 30000
  })

  collector.on('collect', async (collected) => {
    await collected.deferUpdate()
    collector.resetTimer()

    const option = collected.values[0]
    const type = playerOptionsData[option].type

    if (type == 'boolean') {
      playerConfig[option] = !playerConfig[option]

      await interaction.editReply({
        content: baseContent + `\n\n**${option}** toggled -> ${playerConfig[option] ? '✅' : '❌'}!`,
        components: [buildMenu(playerConfig)]
      })
    }
  })

  collector.on('end', async () => {
    await playerOverrides.update({
      dataCopy: playerConfig
    }, { where: { guildId: interaction.guild!.id } })
  })
}