import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, EmbedField, SlashCommandBuilder } from "discord.js"
import Command from "../Interfaces/Command"
import { logger } from "../Tools/logger"

export const define: Command =
{
    permissions: ['SendMessages'],
    data: new SlashCommandBuilder()
        .setName('define')
        .setDescription('Define a word')
        .addStringOption(word => word
            .setName('word')
            .setDescription('Word to be explained')
            .setRequired(true)
        )
        .addStringOption(source => source
            .setName('source')
            .setDescription('Source website')
            .setRequired(true)
            .addChoices(
                {
                    name: 'Urban dictionary (Best for slang)',
                    value: 'source_urban'
                },
                {
                    name: 'Open Dictionary (Best for normal words)',
                    value: 'source_open_dict'
                }
            )
        )
        .addBooleanOption(secret => secret
            .setName('secret')
            .setDescription('Set to True to make the message only visible to you')
        ),

    run: async (command: ChatInputCommandInteraction) => {
        const input: string = command.options.getString('word')
        const source: string = command.options.getString('source')
        const secret: boolean = command.options.getBoolean('secret') ?? false

        const endpoints = {
            source_urban: 'https://api.urbandictionary.com/v0/define?term=',
            source_open_dict: 'https://api.dictionaryapi.dev/api/v2/entries/en/'
        }
        
        const endpoint: string = endpoints[source]

        const res = await fetch(endpoint + input)
            .then(r => r.json())

        if (!res)
        {
            return command.reply({ embeds: [{ description: `Can't find anythin for **${input}**`}]})
        }
        
        
        if (endpoint == endpoints.source_open_dict)
        {
            const parts = res[0].meanings.map(part => part.partOfSpeech)
            let fields: EmbedField[] = []

            for (let i = 0; i < parts.length; i++) 
            {
                fields.push(
                    {
                        name: `As a ${parts[i]}:` ?? '⚠️ Error',
                        value: `${res[0].meanings[i].definitions[0].definition}` ?? '⚠️ Failed to get definition!',
                        inline: false
                    }
                )
            }

            const embed = new EmbedBuilder()
                .setAuthor({ name: `📘 Definition for ${input}` })
                .addFields(fields)

            command.reply({ embeds: [embed], ephemeral: secret })
            return
        } else {
            const len = res.list.length
            let data = res
            let embeds: EmbedBuilder[] = []
            
            if (len > 10) 
            {
                data = res.list.slice(0, 10)
            }

            for (let i = 0; i < data.list.length; i++)
            {
                let cur = data.list[i]
    
                embeds.push(
                    new EmbedBuilder()
                        .setTitle(`${input.charAt(0).toUpperCase() + input.slice(1)}`)
                        .setAuthor({ name: `📘 Definition from Urban Dictionary` })
                        .setURL(cur.permalink)
                        .setDescription(cur.definition)
                        .setFooter({ text: `Page ${i + 1}/${data.list.length}` })
                )
            }

            const buttons = [
                new ButtonBuilder()
                    .setCustomId('back')
                    .setLabel('◀️ Previous')
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Secondary)
            ]

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(buttons)

            const comRes = await command.reply({ embeds: [embeds[0]], components: [row], ephemeral: secret })

            const collector = comRes.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 })

            let page = 0

            collector.on('collect', i => {

                if (i.customId === 'next') 
                {
                    page = page + 1 == embeds.length ? page = 1 : page + 1
                } else {
                    page = page - 1 == 0 ? page = embeds.length : page - 1
                }

                command.editReply({ embeds: [embeds[page]], components: [row] })
                i.deferUpdate()
                collector.resetTimer()
            })

            collector.on('end', _ => {
                const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons[0].setDisabled(true), buttons[1].setDisabled(true))
                command.editReply({ embeds: [embeds[page]], components: [newRow] })
            })
        }
    }
}