import { Menu, showMessage } from "siyuan";
import type { MediaItem, PlaylistConfig } from '../core/types';
import { BilibiliParser } from '../core/bilibili';
import { extractFavMediaId } from '../core/biliUtils';

/**
 * 创建添加标签右键菜单
 * @param i18n 国际化对象
 * @param handlers 处理函数集合
 * @returns 创建菜单函数
 */
export function createAddTabMenu(i18n: any, handlers: {
    onAddLocalFolder: () => void;
    onAddAliCloud: () => void;
    onAddTianYiCloud: () => void;
    onAddQuarkCloud: () => void;
    onAddBilibiliFavorites: () => void;
}) {
    return (e: MouseEvent) => {
        const menu = new Menu("addTabMenu");
        
        // 添加本地文件夹
        menu.addItem({
            icon: "iconFolder",
            label: i18n.playList.menu.addLocalFolder,
            click: handlers.onAddLocalFolder
        });
        
        // 添加阿里云盘
        menu.addItem({
            icon: "iconCloud",
            label: i18n.playList.menu.addAliCloud,
            click: handlers.onAddAliCloud
        });
        
        // 添加天翼云盘
        menu.addItem({
            icon: "iconCloud",
            label: i18n.playList.menu.addTianYiCloud,
            click: handlers.onAddTianYiCloud
        });
        
        // 添加夸克云盘
        menu.addItem({
            icon: "iconCloud",
            label: i18n.playList.menu.addQuarkCloud,
            click: handlers.onAddQuarkCloud
        });
        
        // 添加B站收藏夹
        menu.addItem({
            icon: "iconHeart",
            label: i18n.playList.menu.addBilibiliFavorites,
            click: handlers.onAddBilibiliFavorites
        });
        
        // 打开菜单
        menu.open({ x: e.clientX, y: e.clientY });
    };
}

/**
 * 处理本地文件夹
 * @param folderPath 文件夹路径
 * @param i18n 国际化对象
 * @param handlers 处理函数集合
 */
export async function handleLocalFolder(
    folderPath: string, 
    i18n: any,
    handlers: {
        onCreateTab: (tab: PlaylistConfig) => void;
        onSetActiveTab: (tabId: string) => void;
        onAddMedia: (mediaPath: string) => Promise<void>;
    }
) {
    try {
        // 创建新标签
        const tabId = `folder-${Date.now()}`;
        const folderName = folderPath.split(/[/\\]/).pop() || i18n.playList.folder.defaultName;
        
        // 添加标签
        const newTab: PlaylistConfig = {
            id: tabId,
            name: folderName,
            items: []
        };
        
        // 调用创建标签回调
        handlers.onCreateTab(newTab);
        
        // 设置为活动标签
        handlers.onSetActiveTab(tabId);
        
        // 选择文件夹并处理
        try {
            // @ts-ignore
            const dirHandle = await window.showDirectoryPicker();
            await processDirectoryHandle(dirHandle, folderPath, i18n, handlers.onAddMedia);
        } catch (error) {
            console.error(i18n.playList.error.selectFolderFailed, error);
            showMessage(i18n.playList.error.selectFolderFailed);
        }
    } catch (error) {
        console.error(i18n.playList.error.processLocalFolderFailed, error);
        showMessage(i18n.playList.error.processLocalFolderFailed);
    }
}

/**
 * 处理B站收藏夹
 * @param favUrl B站收藏夹URL
 * @param i18n 国际化对象
 * @param configManager 配置管理器
 * @param handlers 处理函数集合
 */
export async function handleBilibiliFavorites(
    favUrl: string,
    i18n: any,
    configManager: any,
    handlers: {
        onCreateTab: (tab: PlaylistConfig) => void;
        onSetActiveTab: (tabId: string) => void;
        onAddMedia: (mediaPath: string) => Promise<void>;
    }
) {
    try {
        // 从URL提取media_id
        const mediaId = extractFavMediaId(favUrl);
        if (!mediaId) {
            showMessage(i18n.playList.error.invalidFavUrl);
            return;
        }

        // 显示处理中提示
        showMessage(i18n.playList.message.processingFavorites);
        
        // 获取配置
        const config = await configManager.getConfig();
        
        // 获取收藏夹内容列表
        const { title, items } = await BilibiliParser.getFavoritesList(mediaId, config);
        
        if (!items || items.length === 0) {
            showMessage(i18n.playList.error.emptyFavorites);
            return;
        }
        
        // 创建新标签，只使用收藏夹名称作为标签名
        const tabId = `bili-fav-${Date.now()}`;
        
        const newTab: PlaylistConfig = {
            id: tabId,
            name: title,
            items: []
        };
        
        // 调用创建标签回调
        handlers.onCreateTab(newTab);
        
        // 设置为活动标签
        handlers.onSetActiveTab(tabId);
        
        // 依次添加视频
        let addedCount = 0;
        for (const item of items) {
            try {
                // 创建B站视频链接并添加到播放列表
                const bvLink = `https://www.bilibili.com/video/${item.bvid}`;
                await handlers.onAddMedia(bvLink);
                addedCount++;
            } catch (error) {
                console.error(`添加视频 ${item.bvid} 失败:`, error);
            }
        }
        
        // 添加完成提示
        showMessage(i18n.playList.message.favoritesAdded
            .replace('${name}', title)
            .replace('${count}', addedCount.toString()));
    } catch (error) {
        console.error(i18n.playList.error.processFavoritesFailed, error);
        showMessage(i18n.playList.error.processFavoritesFailed);
    }
}

/**
 * 处理目录句柄
 * @param handle 目录句柄
 * @param basePath 基础路径
 * @param i18n 国际化对象
 * @param onAddMedia 添加媒体回调
 */
async function processDirectoryHandle(
    handle: any, 
    basePath: string, 
    i18n: any,
    onAddMedia: (mediaPath: string) => Promise<void>
) {
    try {
        if (handle.kind !== 'directory') return;
        
        // 获取文件夹下的所有文件
        const entries = await handle.entries();
        // 统计添加的媒体数量
        let addedCount = 0;
        
        // 处理每个文件
        for await (const [name, fileHandle] of entries) {
            if (fileHandle.kind === 'file') {
                // 检查是否为媒体文件
                const isMedia = /\.(mp4|webm|avi|mkv|mov|flv|mp3|wav|ogg|flac)$/i.test(name);
                if (isMedia) {
                    const mediaPath = `file://${basePath}/${name}`;
                    await onAddMedia(mediaPath);
                    addedCount++;
                }
            } else if (fileHandle.kind === 'directory') {
                // 处理子文件夹
                await processDirectoryHandle(fileHandle, `${basePath}/${name}`, i18n, onAddMedia);
            }
        }
        
        showMessage(i18n.playList.message.folderAdded
            .replace('${name}', handle.name)
            .replace('${count}', addedCount.toString()));
    } catch (error) {
        console.error(i18n.playList.error.processDirectoryFailed, error);
        showMessage(i18n.playList.error.processDirectoryFailed);
    }
} 