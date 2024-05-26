exports = async function({ query, headers, body }, response) {
  // チャットの入力テキストを取得
  const { chatInput } = query;

  // 全文検索のインデックスが作成されていることを前提とする
  const docs = await context.services
    .get("mongodb-atlas")
    .db("video1_frames") // データベース名
    .collection("cluster0") // コレクション名
    .find(
      { $text: { $search: chatInput } }, // 全文検索
      { score: { $meta: "textScore" } } // スコア付きで検索
    )
    .sort({ score: { $meta: "textScore" } }) // スコアでソート
    .limit(10) // 上位10件を取得
    .toArray();

  return docs;
};