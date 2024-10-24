import { HorizontalAlign, Jimp, loadFont, VerticalAlign } from "jimp";
import { SANS_64_BLACK } from "jimp/fonts";

import * as path from 'path';
import * as fs from 'fs';

export default async function generateInitialsImage(username: string) {
    const initials = username.slice(0, 2).toUpperCase();
    const image = new Jimp({
        width: 100,
        height: 100,
        color: "#FFF",
    })

    const font = await loadFont(SANS_64_BLACK);
    image.print({
        font,
        text: initials,
        x: HorizontalAlign.CENTER,
        y: VerticalAlign.MIDDLE,
        maxHeight: 100,
        maxWidth: 100
    })

    const profileDir = path.join(__dirname, '..', '..', process.env.UPLOADS_DIR + "/profile");
    if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
    }

    const filePath = path.join(profileDir, `${username}_profile`);

    await image.write(`${filePath}.${"png"}`);

    return `/uploads/profile/${username}_profile.png`;
}   