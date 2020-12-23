const { App } = require('@slack/bolt');
require('dotenv').config();

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

(async () => {
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Bolt app is running!');
})();

app.shortcut('analyze_post_reaction', async ({ shortcut, ack, context }: any) => {
    await ack();

    try {
        const result = await app.client.views.open({
            token: context.botToken,
            // 適切な trigger_id を受け取ってから 3 秒以内に渡す
            trigger_id: shortcut.trigger_id,
            // view の値をペイロードに含む
            view: {
                type: 'modal',
                // callback_id が view を特定するための識別子
                callback_id: 'view_1',
                title: {
                    type: 'plain_text',
                    text: 'Modal title'
                },
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: 'Welcome to a modal with _blocks_'
                        },
                        accessory: {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: 'Click me!'
                            },
                            action_id: 'button_abc'
                        }
                    },
                    {
                        type: 'input',
                        block_id: 'input_c',
                        label: {
                            type: 'plain_text',
                            text: 'What are your hopes and dreams?'
                        },
                        element: {
                            type: 'plain_text_input',
                            action_id: 'dreamy_input',
                            multiline: true
                        }
                    }
                ],
                submit: {
                    type: 'plain_text',
                    text: 'Submit'
                }
            }
        });
        console.log(result);
    }
    catch (error) {
        console.error(error);
    }
})