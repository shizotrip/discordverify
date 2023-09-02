const {
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const codeSchema = require('../schemas/codes');
const nodemailer = require('nodemailer');

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction) {
        const lang = interaction.client.config.lang == 'ru';

        if (interaction.customId == 'openMailForm') {
            const modal = new ModalBuilder()
                .setCustomId('mailForm')
                .setTitle(lang ? 'Верификация' : 'Verifaction');

            const mail = new TextInputBuilder()
                .setCustomId('mailInput')
                .setStyle(TextInputStyle.Short)
                .setLabel(lang ? 'Mail address:' : 'Your Mail Address:')
                .setPlaceholder(lang ? 'shizotrip@proton.me' : 'shizotrip@proton.me');

            const field = new ActionRowBuilder().addComponents(mail);

            modal.addComponents(field);

            await interaction.showModal(modal);
        }

        if (interaction.customId == 'mailForm') {
            await interaction.deferReply({ ephemeral: true });

            const mail = interaction.fields.getTextInputValue('mailInput');

            const embed = new EmbedBuilder()
                .setColor(interaction.message.embeds[0].color)
                .setAuthor({
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                    name: `${interaction.user.tag} (${interaction.user.id})`,
                })
                .setDescription(
                    lang
                        ? 'Чтобы зарегистрироваться, нажмите на кнопку ниже и введите свой адрес электронной почты в появившуюся форму, после чего мы вышлем на ваш электронный адрес проверочный код.'
                        : 'If you want to confirm that the email address is correct and belongs to you in order to receive the verification code, please click on the relevant button below.'
                )
                .addFields({
                    name: lang ? 'Mail address:' : 'Your Mail Address:',
                    value: mail,
                });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('sendVerifactionCode')
                    .setStyle(ButtonStyle.Primary)
                    .setLabel(lang ? 'Отправить код' : 'Send Verifaction Code'),
                new ButtonBuilder()
                    .setCustomId('approveCode')
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(lang ? 'Подтвердить код' : 'Approve Code')
                    .setDisabled(true)
            );

            await interaction.editReply({
                embeds: [embed],
                components: [row],
            });
        }

        if (interaction.customId == 'sendVerifactionCode') {
            const row = ActionRowBuilder.from(interaction.message.components[0]);
            const embed = EmbedBuilder.from(interaction.message.embeds[0]);

            const code = Math.floor(Math.random() * 900000) + 100000;

            await codeSchema.findByIdAndUpdate(
                interaction.user.id,
                { $set: { code } },
                { upsert: true }
            );

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: interaction.client.config.google.mail,
                    pass: interaction.client.config.google.password,
                },
            });

            const options = {
                from: `"${interaction.client.config.options.mailTitle}" <${interaction.client.config.google.mail}>`,
                to: `${interaction.message.embeds[0].data.fields[0].value}`,
                subject: `${interaction.client.config.options.mailSubject}`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Код верификации</title>
                        <style>
                            body {
                            background-color: #f2f2f2;
                            font-family: Arial, sans-serif;
                            }

                            .container {
                            max-width: 400px;
                            margin: 0 auto;
                            padding: 20px;
                            background-color: #ffffff;
                            border-radius: 5px;
                            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                            }

                            h1 {
                            text-align: center;
                            color: #333333;
                            }

                            .verification-code {
                            text-align: center;
                            font-size: 28px;
                            font-weight: bold;
                            color: #333333;
                            margin-top: 30px;
                            }

                            .instructions {
                            text-align: center;
                            color: #666666;
                            margin-top: 10px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>${lang ? 'Код верификации' : 'Verifaction Code'}</h1>
                            <div class="verification-code">${code}</div>
                            <div class="instructions">
                                ${
                                    lang
                                        ? 'Введите указанный выше код проверки в появившуюся форму, нажав на кнопку "Проверить код", активную в Discord, и завершите процесс проверки.'
                                        : 'Enter the above verification code into the form that appears when you click the "Approve Code" button in Discord and complete the verification process.'
                                }
                            </div>
                        </div>
                    </body>
                    </html>
                `,
            };

            transporter.sendMail(options, async function (error, info) {
                if (error) {
                    console.log('\x1b[31m', `[-] Почта не отправляется. (${error})`);

                    return await interaction.update({
                        content: lang
                            ? 'Произошла ошибка, повторите попытку позже.'
                            : 'An error occurred, please try again later.',
                        embeds: [],
                        components: [],
                    });
                }
            });

            row.components[0].setStyle(ButtonStyle.Success);
            row.components[0].setDisabled(true);

            row.components[1].setStyle(ButtonStyle.Primary);
            row.components[1].setDisabled(false);

            await interaction.update({
                content: lang
                    ? 'Отправлен код верификации.'
                    : 'The verification code has been sent.',
                embeds: [embed],
                components: [row],
            });
        }

        if (interaction.customId == 'approveCode') {
            const modal = new ModalBuilder()
                .setCustomId('approveCodeForm')
                .setTitle(lang ? 'Верификация' : 'Verifaction');

            const code = new TextInputBuilder()
                .setCustomId('codeInput')
                .setStyle(TextInputStyle.Short)
                .setLabel(lang ? 'Введите код:' : 'Enter The Code:')
                .setPlaceholder('000000');

            const field = new ActionRowBuilder().addComponents(code);

            modal.addComponents(field);

            await interaction.showModal(modal);
        }

        if (interaction.customId == 'approveCodeForm') {
            const code = interaction.fields.getTextInputValue('codeInput');

            const row = ActionRowBuilder.from(interaction.message.components[0]);
            const embed = EmbedBuilder.from(interaction.message.embeds[0]);

            const data = await codeSchema.findById(interaction.user.id);

            if (code != data.code) {
                row.components[1].setStyle(ButtonStyle.Danger);

                embed.setDescription(
                    lang
                        ? 'Введенный код не совпадает, попробуйте еще раз.'
                        : 'The entered code does not match, please try again.'
                );

                return await interaction.update({
                    embeds: [embed],
                    components: [row],
                });
            }

            row.components[1].setStyle(ButtonStyle.Success);
            row.components[1].setDisabled(true);

            embed.setDescription(
                lang
                    ? 'Верификация успешна, регистрация продолжается...'
                    : 'Verification successful, registration processes are being carried out...'
            );

            await interaction.update({
                embeds: [embed],
                components: [row],
            });

            await codeSchema.findByIdAndDelete(interaction.user.id);

            try {
                if (interaction.client.config.roles.retrievedRole.length > 0) {
                    interaction.client.config.roles.retrievedRole.some(
                        async (role) => await interaction.member.roles.remove(role)
                    );
                }

                if (interaction.client.config.roles.assignedRole.length > 0) {
                    interaction.client.config.roles.assignedRole.some(
                        async (role) => await interaction.member.roles.add(role)
                    );
                }
            } catch {
                return;
            }
        }
    },
};
