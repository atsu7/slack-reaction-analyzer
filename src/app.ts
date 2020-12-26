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
        const selectedEmojiName: string = action.selected_option.value;
        const selectedReactionObj: { [key: string]: any; } = reactionsResult.message.reactions.find((reaction: any) => reaction.name === selectedEmojiName);
        const reactionUsers: string[] = selectedReactionObj.users; //選択した絵文字を使用したユーザーのIDの配列
        const reactionCount: number = selectedReactionObj.count;

        const otherEmojisArray = reactionUsers.map((userId: string) => {
            const otherReactionsObjs: { [key: string]: any; } = reactionsResult.message.reactions.filter((reactionobj: any) => { return reactionobj.name !== selectedEmojiName && reactionobj.users.includes(userId) }); //他のリアクションオブジェクトの配列
            const otherReactionNames: string[] = otherReactionsObjs.map((reactionobj: any) => reactionobj.name);
            return otherReactionNames;
        }) // [[Aさんの他の絵文字names],[Bさんの他の絵文字names],...]

        const userPics: any = reactionUsers.map(async (userId: string) => {
            const payload = await app.client.users.profile.get({
                token: context.botToken,
                user: userId
            })
            return payload.profile.image_24;
        });
        const picUrls = await Promise.all(userPics).then((url) => url); //HACK userpicsがpromiseオブジェクトの配列だったので、変換（？）

        // reactionUsers, otherEmojisArray, userPicsはそれぞれ同じ順番で並んでいるのでmapの順番で呼び出す
        let i: number = 0;
        const usersBlocks = reactionUsers.map((userId: string) => {
            //otherEmojisArrayの空判定をしたほうがよい。（空白の::を消すため）
            let otherEmojisText: string = otherEmojisArray[i].join('::');
            let pic = picUrls[i]; //これなら動く。文字列にすると動かなくなる。
            i++;
            return {

                "type": "context",
                "elements": [
                    {
                        "type": "image",
                        "image_url": pic,
                        "alt_text": "cute cat"
                    },
                    {
                        "type": "mrkdwn",
                        "text": `<@${userId}>:${otherEmojisText}:`
                    }
                ]
            }
        })

        const result = await app.client.views.update({
            token: context.botToken,
            view_id: body.view.id,
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
                "private_metadata": body.view.private_metadata, // 投稿の情報を格納したデータを引き継ぐ
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
                            "initial_option": {
                                "text": {
                                    "type": "plain_text",
                                    "text": `:${selectedEmojiName}:`,
                                    "emoji": true
                                },
                                "value": selectedEmojiName
                            },
                            "action_id": "static_select-action-emoji"
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": `:${selectedEmojiName}: *${reactionCount}人*`
                        }
                    },
                    ...usersBlocks, // 配列を展開
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
                                "action_id": "share_in_a_channel"
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


app.action('share_in_a_channel', async ({ ack, context, body }: any) => {
    await ack();
    const postBlock = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `<https://${body.team.domain}.slack.com/archives/${body.view.private_metadata.split(',')[0]}/p${body.view.private_metadata.split(',')[1]}|こちらの投稿>に現時点でつけられたリアクションです。`,
            }
        },
        ...body.view.blocks.slice(2, -1)]

    await app.client.chat.postMessage({
        token: context.botToken,
        channel: body.view.private_metadata.split(',')[0],
        text: `https://${body.team.domain}.slack.com/archives/${body.view.private_metadata.split(',')[0]}/p${body.view.private_metadata.split(',')[1]} に現時点でつけられたリアクションです。`,
        blocks: postBlock, //　ユーザーを表示する部分のみ
        unfurl_links: true

    })
});