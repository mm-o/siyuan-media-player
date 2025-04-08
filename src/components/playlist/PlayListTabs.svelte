<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { Menu, showMessage } from "siyuan";
    import type { PlaylistConfig as BasePlaylistConfig } from '../../core/types';
    import { BilibiliParser } from '../../core/bilibili';
    import { extractFavMediaId } from '../../core/biliUtils';

    // 扩展 PlaylistConfig 类型，添加 isEditing 属性
    interface PlaylistConfig extends BasePlaylistConfig {
        isEditing?: boolean;
    }

    // 组件属性
    export let tabs: PlaylistConfig[] = [];
    export let activeTabId: string = 'default';
    export let i18n: any;
    export let configManager: any; // 添加configManager属性用于处理B站收藏夹
    
    // 组件状态
    let isAddingTab = false;
    let inputMode: 'normal' | 'localFolder' | 'bilibiliFavorites' = 'normal';
    let newTabInput: HTMLInputElement;
    
    // 事件分发器
    const dispatch = createEventDispatcher<{
        tabChange: { tabId: string };
        tabsUpdate: { tabs: PlaylistConfig[] };
        addMedia: { url: string };
    }>();

    /**
     * 创建添加标签右键菜单
     */
    function createAddTabMenu(event: MouseEvent) {
        const menu = new Menu("addTabMenu");
        
        // 添加本地文件夹
        menu.addItem({
            icon: "iconFolder",
            label: i18n.playList.menu.addLocalFolder,
            click: () => {
                isAddingTab = true;
                inputMode = 'localFolder';
                setTimeout(() => newTabInput?.focus(), 0);
            }
        });
        
        // 添加阿里云盘
        menu.addItem({
            icon: "iconCloud",
            label: i18n.playList.menu.addAliCloud,
            click: () => {
                showMessage(i18n.playList.message.notImplemented);
            }
        });
        
        // 添加天翼云盘
        menu.addItem({
            icon: "iconCloud",
            label: i18n.playList.menu.addTianYiCloud,
            click: () => {
                showMessage(i18n.playList.message.notImplemented);
            }
        });
        
        // 添加夸克云盘
        menu.addItem({
            icon: "iconCloud",
            label: i18n.playList.menu.addQuarkCloud,
            click: () => {
                showMessage(i18n.playList.message.notImplemented);
            }
        });
        
        // 添加B站收藏夹
        menu.addItem({
            icon: "iconHeart",
            label: i18n.playList.menu.addBilibiliFavorites,
            click: () => {
                isAddingTab = true;
                inputMode = 'bilibiliFavorites';
                setTimeout(() => newTabInput?.focus(), 0);
            }
        });
        
        // 打开菜单
        menu.open({ x: event.clientX, y: event.clientY });
    }
    
    /**
     * 处理本地文件夹
     */
    async function handleLocalFolder(folderPath: string) {
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
            
            // 添加标签并更新
            tabs = [...tabs, newTab];
            dispatch('tabsUpdate', { tabs });
            
            // 设置为活动标签
            setActiveTab(tabId);
            
            // 选择文件夹并处理
            try {
                // @ts-ignore
                const dirHandle = await window.showDirectoryPicker();
                await processDirectoryHandle(dirHandle, folderPath);
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
     * 处理目录句柄
     */
    async function processDirectoryHandle(handle: any, basePath: string) {
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
                        dispatch('addMedia', { url: mediaPath });
                        addedCount++;
                    }
                } else if (fileHandle.kind === 'directory') {
                    // 处理子文件夹
                    await processDirectoryHandle(fileHandle, `${basePath}/${name}`);
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
    
    /**
     * 处理B站收藏夹
     */
    async function handleBilibiliFavorites(favUrl: string) {
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
            
            // 添加标签并更新
            tabs = [...tabs, newTab];
            dispatch('tabsUpdate', { tabs });
            
            // 设置为活动标签
            setActiveTab(tabId);
            
            // 依次添加视频
            let addedCount = 0;
            for (const item of items) {
                try {
                    // 创建B站视频链接并添加到播放列表
                    const bvLink = `https://www.bilibili.com/video/${item.bvid}`;
                    dispatch('addMedia', { url: bvLink });
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
     * 标签操作
     */
    const tabActions = {
        add() {
            if (!isAddingTab) {
                isAddingTab = true;
                // 设置添加普通标签状态
                inputMode = 'normal';
                setTimeout(() => newTabInput?.focus(), 0);
            }
        },

        save(event: KeyboardEvent | FocusEvent, tab?: PlaylistConfig) {
            if (event instanceof KeyboardEvent && event.key !== 'Enter') return;
            
            const input = event.target as HTMLInputElement;
            const newName = input.value.trim();
            
            if (tab) {
                // 保存已有标签
                tabs = tabs.map(t => 
                    t.id === tab.id 
                    ? { ...t, name: newName || t.name, isEditing: false }
                    : t
                );
                // 触发标签更新事件
                dispatch('tabsUpdate', { tabs });
            } else if (newName) {
                if (inputMode === 'normal') {
                    // 添加普通标签
                    const newTab: PlaylistConfig = {
                        id: `tab-${Date.now()}`,
                        name: newName,
                        items: []
                    };
                    tabs = [...tabs, newTab];
                    // 触发标签更新事件
                    dispatch('tabsUpdate', { tabs });
                    // 自动切换到新标签
                    setActiveTab(newTab.id);
                } else if (inputMode === 'localFolder') {
                    // 处理本地文件夹路径
                    handleLocalFolder(newName);
                } else if (inputMode === 'bilibiliFavorites') {
                    // 处理B站收藏夹
                    handleBilibiliFavorites(newName);
                }
                
                // 清空输入框与状态
                isAddingTab = false;
            } else {
                // 空输入则取消添加标签
                isAddingTab = false;
            }
            
            input.value = '';
        },

        showContextMenu(event: MouseEvent, tab: PlaylistConfig) {
            // 创建右键菜单
            const menu = new Menu("tabContextMenu");
            
            // 仅对非固定标签显示编辑选项
            if (!tab.isFixed) {
                // 添加重命名项
                menu.addItem({
                    icon: "iconEdit",
                    label: i18n.playList.menu.rename,
                    click: () => {
                        // 将当前标签设置为编辑状态
                        tabs = tabs.map(t => ({
                            ...t,
                            isEditing: t.id === tab.id
                        }));
                        
                        // 触发标签更新事件
                        dispatch('tabsUpdate', { tabs });
                        
                        // 延迟执行，确保DOM更新后再获取输入框
                        setTimeout(() => {
                            const input = document.querySelector(`#tab-edit-${tab.id}`) as HTMLInputElement;
                            input?.focus();
                            input?.select();
                        }, 0);
                    }
                });
                
                // 添加删除项
                menu.addItem({
                    icon: "iconTrashcan",
                    label: i18n.playList.menu.delete,
                    click: () => {
                        // 从标签列表中移除当前标签
                        tabs = tabs.filter(t => t.id !== tab.id);
                        
                        // 如果当前标签是激活的，设置默认标签为激活
                        if (activeTabId === tab.id) {
                            setActiveTab('default');
                        }
                        
                        // 触发标签更新事件
                        dispatch('tabsUpdate', { tabs });
                    }
                });
                
                menu.addSeparator();
            }
            
            // 为所有标签添加清空选项
            menu.addItem({
                icon: "iconClear",
                label: i18n.playList.menu.clear,
                click: () => {
                    // 清空标签内容
                    tabs = tabs.map(t => 
                        t.id === tab.id 
                        ? { ...t, items: [] }
                        : t
                    );
                    
                    // 触发标签更新事件
                    dispatch('tabsUpdate', { tabs });
                    
                    showMessage(i18n.playList.message.listCleared.replace('${name}', tab.name));
                }
            });
            
            // 打开右键菜单
            menu.open({ x: event.clientX, y: event.clientY });
        }
    };
    
    /**
     * 设置活动标签
     */
    function setActiveTab(tabId: string) {
        activeTabId = tabId;
        dispatch('tabChange', { tabId });
    }
</script>

<div class="playlist-tabs">
    {#each tabs as tab (tab.id)}
        {#if tab.isEditing}
            <div class="tab-edit-wrapper">
                <input
                    id="tab-edit-{tab.id}"
                    type="text"
                    class="tab-input"
                    value={tab.name}
                    on:blur={(e) => tabActions.save(e, tab)}
                    on:keydown={(e) => tabActions.save(e, tab)}
                />
            </div>
        {:else}
            <button 
                class="tab" 
                class:active={activeTabId === tab.id}
                on:click={() => setActiveTab(tab.id)}
                on:contextmenu|preventDefault={(e) => tabActions.showContextMenu(e, tab)}
            >
                {tab.name}
            </button>
        {/if}
    {/each}
    
    <div class="tab-add-wrapper">
        {#if isAddingTab}
            <input
                bind:this={newTabInput}
                type="text"
                class="tab-input"
                style="width: 100px; max-width: 100px;"
                placeholder={inputMode === 'localFolder' ? i18n.playList.placeholder.folderPath : inputMode === 'bilibiliFavorites' ? i18n.playList.placeholder.bilibiliFavorites : i18n.playList.placeholder.newTab}
                on:blur={tabActions.save}
                on:keydown={tabActions.save}
            />
        {:else}
            <button 
                class="tab tab-add" 
                on:click={tabActions.add}
                on:contextmenu|preventDefault={createAddTabMenu}
            >+</button>
        {/if}
    </div>
</div> 