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
        const reactionsResult = await app.client.reactions.get({
            token: context.botToken,
            channel: shortcut.channel.id,
            timestamp: shortcut.message.ts,
            full: true
        });

        const reactionOptions = await reactionsResult.message.reactions.map((item: any) => ({
            "text": {
                "type": "plain_text",
                "text": `:${item.name}:`,
                "emoji": true
            },
            "value": item.name
        }));

        const result = await app.client.views.open({
            token: context.botToken,
            // 適切な trigger_id を受け取ってから 3 秒以内に渡す
            trigger_id: shortcut.trigger_id,
            // view の値をペイロードに含む
            view: {
                "type": "modal",
                "title": {
                    "type": "plain_text",
                    "text": "Emoji reaction analyzer",
                    "emoji": true
                },
                "close": {
                    "type": "plain_text",
                    "text": "閉じる",
                    "emoji": true
                },
                "private_metadata": `${shortcut.channel.id},${shortcut.message.ts}`, // private metadataで最初のメッセージ情報を引き継ぐ
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "plain_text",
                            "text": "選択した絵文字でリアクションした人を表示します。他の絵文字は名前の横に表示されます。",
                            "emoji": true
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "表示する絵文字を選択してください。"
                        },
                        "accessory": {
                            "type": "static_select",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Select an item",
                                "emoji": true
                            },
                            "options": reactionOptions,
                            "action_id": "static_select-action-emoji"
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "*3人*"
                        }
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "image",
                                "image_url": "https://ca.slack-edge.com/T02JKBSBK-UJL3GRUAC-f1a2855ce034-512",
                                "alt_text": "cute cat"
                            },
                            {
                                "type": "mrkdwn",
                                "text": "<@UJL3GRUAC>:+1::arrive-late:"
                            }
                        ]
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "image",
                                "image_url": "https://pbs.twimg.com/profile_images/625633822235693056/lNGUneLX_400x400.jpg",
                                "alt_text": "cute cat"
                            },
                            {
                                "type": "mrkdwn",
                                "text": "<@UJN7RSQK0>"
                            }
                        ]
                    },

                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "チャンネルに共有",
                                    "emoji": true
                                },
                                "value": "click_me_123",
                                "action_id": "actionId-0"
                            }
                        ]
                    }
                ]
            }
        });
        // console.log(result);


    }
    catch (error) {
        console.error(error);
    }
})

app.action(('static_select-action-emoji'), async ({ ack, say, action, context, body }: any) => {
    await ack();
    // アクションを反映してメッセージをアップデート
    try {
        const reactionsResult = await app.client.reactions.get({
            token: context.botToken,
            channel: body.view.private_metadata.split(',')[0],
            timestamp: body.view.private_metadata.split(',')[1],
            full: true
        });

        const reactionOptions = await reactionsResult.message.reactions.map((item: any) => ({
            "text": {
                "type": "plain_text",
                "text": `:${item.name}:`,
                "emoji": true
            },
            "value": item.name
        }));
        console.log(action);
        const result = await app.client.views.update({
            token: context.botToken,
            view_id:body.view.id,
            view: {
                "type": "modal",
                "title": {
                    "type": "plain_text",
                    "text": "Emoji reaction analyzer",
                    "emoji": true
                },
                "close": {
                    "type": "plain_text",
                    "text": "閉じる",
                    "emoji": true
                },
                "private_metadata": body.view.private_metadata,
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "plain_text",
                            "text": "選択した絵文字でリアクションした人を表示します。他の絵文字は名前の横に表示されます。",
                            "emoji": true
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "表示する絵文字を選択してください。"
                        },
                        "accessory": {
                            "type": "static_select",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Select an item",
                                "emoji": true
                            },
                            "options": reactionOptions,
                            "initial_option":{
                                "text": {
                                    "type": "plain_text",
                                    "text": `:${action.selected_option.value}:`,
                                    "emoji": true
                                },
                                "value": action.selected_option.value
                            },
                            "action_id": "static_select-action-emoji"
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": `:${action.selected_option.value}: *3人*`
                        }
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "image",
                                "image_url": "https://ca.slack-edge.com/T02JKBSBK-UJL3GRUAC-f1a2855ce034-512",
                                "alt_text": "cute cat"
                            },
                            {
                                "type": "mrkdwn",
                                "text": "<@UJL3GRUAC>:+1:update"
                            }
                        ]
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "image",
                                "image_url": "https://pbs.twimg.com/profile_images/625633822235693056/lNGUneLX_400x400.jpg",
                                "alt_text": "cute cat"
                            },
                            {
                                "type": "mrkdwn",
                                "text": "<@UJN7RSQK0>"
                            }
                        ]
                    },

                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "チャンネルに共有",
                                    "emoji": true
                                },
                                "value": "click_me_123",
                                "action_id": "actionId-0"
                            }
                        ]
                    }
                ]
            }
        });
    } catch (error) {
        console.error(error);
    }
})