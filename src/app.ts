import { AckFn, Context, MessageShortcut, Installation, InstallationQuery } from "@slack/bolt";

const { App, ExpressReceiver } = require('@slack/bolt');
require('@slack/bolt');
require('dotenv').config();
const serverlessExpress = require('@vendia/serverless-express')
let AWS = require("aws-sdk")

AWS.config.update({
    region: "ap-northeast-1",
    endpoint: "https://dynamodb.ap-northeast-1.amazonaws.com",
});

let docClient = new AWS.DynamoDB.DocumentClient();

const expressReceiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    stateSecret: process.env.SLACK_STATE_SECRET,
    scopes: ['chat:write', 'chat:write.public', 'commands', 'reactions:read', 'users.profile:read'],
    installationStore: {
        storeInstallation: async (installation: Installation) => {
            console.log(installation)
            if (installation.isEnterpriseInstall) {
                // OrG 全体へのインストールに対応する場合
                const params = {
                    TableName: 'workspaces',
                    Item: {
                        workspaceId: installation.enterprise?.id,
                        installationData: installation
                    },
                };
                return await docClient.put(params, function (err: any, data: any) {
                    if (err) console.log(err);
                    else console.log(data);
                });

            } else {
                // 単独のワークスペースへのインストールの場合
                const params = {
                    TableName: 'workspaces',
                    Item: {
                        workspaceId: installation.team?.id,
                        installationData: installation
                    },
                };
                return await docClient.put(params, function (err: any, data: any) {
                    if (err) console.log(err);
                    else console.log(data);
                });
            }

        },
        fetchInstallation: async (installQuery: any) => {
            if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
                // OrG 全体へのインストール情報の参照
                const params = {
                    TableName: 'workspaces',
                    Key: {
                        workspaceId: installQuery.enterpriseId
                    }
                };


                const fetchedData = await docClient.get(params, function (err: any, data: any) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log(data.Item)
                    }
                }).promise();

                return fetchedData.Item.installationData
            }
            if (installQuery.teamId !== undefined) {
                // 単独のワークスペースへのインストール情報の参照
                const params = {
                    TableName: 'workspaces',
                    Key: {
                        workspaceId: installQuery.teamId
                    }
                };

                const fetchedData = await docClient.get(params, function (err: any, data: any) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log(data.Item)
                    }
                }).promise();

                return fetchedData.Item.installationData

            }
        },
    },
    processBeforeResponse: true
});

const app = new App({
    receiver: expressReceiver
});

// (async () => {
//     await app.start(process.env.PORT || 3000);
//     console.log('⚡️ Bolt app is running!');
// })();

// Lambda 関数のイベントを処理します
module.exports.handler = serverlessExpress({
    app: expressReceiver.app
});

app.shortcut('analyze_post_reaction', async ({ shortcut, ack, context }: { shortcut: MessageShortcut, ack: any, context: Context }) => {
    await ack();

    try {
        let reactionsResult
        try {
            reactionsResult = await app.client.reactions.get({
                token: context.botToken,
                channel: shortcut.channel.id,
                timestamp: shortcut.message.ts,
                full: true
            });

            //FIXここ以降はtryの１つ外にあるべき
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
        } catch (error) {//FIX 正しくエラー判定していない
            console.log(error)
            app.client.chat.postEphemeral({
                token: context.botToken,
                channel: shortcut.channel.id,
                text: "使用するには、このチャンネルにbotを招待してください。\n`/invite @Reaction Analyzer`",
                user: shortcut.user.id
            })
        }



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
            let otherEmojisText: string = '';
            console.log(otherEmojisArray)
            if (otherEmojisArray[i].length) {
                otherEmojisText = ':' + otherEmojisArray[i].join('::') + ':';
            }
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
                        "text": `<@${userId}>${otherEmojisText}`
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