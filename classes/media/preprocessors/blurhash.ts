import { encode } from "blurhash";
import sharp from "sharp";

export const calculateBlurhash = async (file: File): Promise<string | null> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const metadata = await sharp(arrayBuffer).metadata();

        return new Promise<string | null>((resolve) => {
            sharp(arrayBuffer)
                .raw()
                .ensureAlpha()
                .toBuffer((err, buffer) => {
                    if (err) {
                        resolve(null);
                        return;
                    }

                    try {
                        resolve(
                            encode(
                                new Uint8ClampedArray(buffer),
                                metadata?.width ?? 0,
                                metadata?.height ?? 0,
                                4,
                                4,
                            ) as string,
                        );
                    } catch {
                        resolve(null);
                    }
                });
        });
    } catch {
        return null;
    }
};
