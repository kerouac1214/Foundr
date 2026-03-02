
export interface LoadingInsight {
    image: string;
    title: string;
    prompt: string;
    tip: string;
}

export const LOADING_INSIGHTS: LoadingInsight[] = [
    {
        image: "/assets/loading/loading_noir_rain.png",
        title: "雨夜霓虹 (Noir Rain Aesthetic)",
        prompt: "Hyper-realistic cinematic still of a detective in a dark trench coat standing under a flickering neon 'Hotel' sign in a rainy alleyway. Wet asphalt reflecting neon lights, heavy rain drops, 35mm film texture.",
        tip: "技巧：使用'Wet asphalt'和'Neon reflection'能瞬间增加雨夜场景的层次感和电影质感。"
    },
    {
        image: "/assets/loading/loading_golden_hour.png",
        title: "黄金时刻 (Golden Hour)",
        prompt: "Hyper-realistic cinematic close-up of a young woman standing in a vast wheat field during the sunset. Backlit by warm orange sun, soft lens flare, realistic skin texture, 85mm f/1.4 lens.",
        tip: "小知识：黄金时刻（日落前一小时）的光线最柔和，是拍摄富有情感张力的人像最佳时机。"
    },
    {
        image: "/assets/loading/loading_gritty_realism.png",
        title: "纪实写实 (Gritty Realism)",
        prompt: "Extreme close-up portrait of an elderly man with deeply weathered skin. Natural soft window lighting, cinematic documentary style, 100mm macro lens, every wrinkle visible.",
        tip: "提示：加入'Gritty'和'Weathered skin'等词汇能引导 AI 避开过度磨皮，获得极致的写实纹理。"
    },
    {
        image: "/assets/loading/loading_cyber_rooftop.png",
        title: "赛博高空 (Cyber Rooftop)",
        prompt: "Hyper-realistic cinematic still of a futuristic traveler sitting on the edge of a skyscraper rooftop. Overlooking a massive glowing megalopolis. 24mm wide angle, scale and vertigo.",
        tip: "构图：'24mm Wide Angle' 配合高处视角，能极大地增强画面的纵深感和‘恐高症’式的视觉冲击。"
    },
    {
        image: "/assets/loading/loading_desert_solitude.png",
        title: "荒原戈壁 (Desert Solitude)",
        prompt: "Hyper-realistic cinematic still of a lone person walking across massive sand dunes. Intense midday sun, harsh shadows, extreme heat haze, 50mm lens.",
        tip: "色彩：强烈的‘冷暖对比’或极端的‘单色调’（如荒漠黄）能强化环境的压抑感或孤独感。"
    },
    {
        image: "/assets/loading/loading_vintage_library.png",
        title: "古典光影 (Vintage Library)",
        prompt: "Hyper-realistic cinematic still of a dusty, ancient library. Beams of sunlight cutting through massive windows with visible dust motes. Cinematic haze, 35mm film.",
        tip: "氛围：使用'Cinematic haze'和'Dust motes'可以为静止的室内场景注入流动的空气感和历史感。"
    },
    {
        image: "/assets/loading/loading_cyber_street.png",
        title: "赛博街头 (Cyber Street)",
        prompt: "Hyper-realistic cinematic street photography of a futuristic night market in a rainy alley. Dense atmosphere, hundreds of neon signs, steam rising.",
        tip: "小技巧：'Anamorphic lens'（变形宽屏镜头）能带来独特的拉丝光晕，是科幻大片的视觉标配。"
    },
    {
        image: "/assets/loading/loading_scifi_industrial.png",
        title: "科幻工业 (Sci-Fi Industrial)",
        prompt: "Massive spaceship hangar with orange sparks flying. Scale and depth, cinematic industrial aesthetic, anamorphic lens flares, teal and orange color grading.",
        tip: "构图：'Anamorphic lens flares'（宽银幕拉丝光晕）是好莱坞科幻大片的视觉标志。"
    },
    {
        image: "/assets/loading/loading_urban_reflection.png",
        title: "都市倒影 (Urban Reflection)",
        prompt: "Cinematic street photography of a rainy evening in London. Reflection of red buses and neon storefronts in a large puddle. Motion blur, f/2.8, sharp focus on water ripples.",
        tip: "技巧：改变视角关注‘倒影’（Reflection），能让平凡的街道场景呈现出非凡的艺术感。"
    }
];
