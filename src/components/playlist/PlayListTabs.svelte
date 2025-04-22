<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { Menu, showMessage } from "siyuan";
    import type { PlaylistConfig as BasePlaylistConfig } from '../../core/types';
    import { BilibiliParser } from '../../core/bilibili';
    import { checkProEnabled, showProFeatureNotEnabledMessage } from '../../core/utils';
    import { onMount, onDestroy } from 'svelte';

    // 类型定义
    interface PlaylistConfig extends BasePlaylistConfig {
        isEditing?: boolean;
    }

    // ===== 组件属性 =====
    export let tabs: PlaylistConfig[] = [];
    export let activeTabId: string = 'default';
    export let i18n: any;
    export let configManager: any;
    
    // ===== 常量定义 =====
    const MEDIA_FILE_REGEX = /\.(mp4|webm|avi|mkv|mov|flv|mp3|wav|ogg|flac)$/i;
    const TIMESTAMP = Date.now;
    const TAB_PREFIX = {
        normal: 'tab',
        folder: 'folder',
        biliFav: 'bili-fav'
    };

    // ===== 组件状态 =====
    let isAddingTab = false;
    let inputMode: 'normal' | 'localFolder' = 'normal';
    let newTabInput: HTMLInputElement;
    
    // ===== 事件分发 =====
    const dispatch = createEventDispatcher<{
        tabChange: { tabId: string };
        tabsUpdate: { tabs: PlaylistConfig[] };
        addMedia: { url: string; options?: { autoPlay?: boolean } };
    }>();

    // ===== 功能实现 =====
    
    /**
     * 添加媒体到播放列表
     */
    function addMedia(url: string, autoPlay = false) {
        dispatch('addMedia', {url, options: {autoPlay}});
        return true;
    }

    /**
     * 创建新标签页
     */
    function createNewTab(id: string, name: string): void {
        tabs = [...tabs, {id, name, items: []}];
        updateTabs();
        setActiveTab(id);
    }

    /**
     * 更新标签列表
     */
    function updateTabs() {
        dispatch('tabsUpdate', {tabs});
    }

    /**
     * 设置活动标签
     */
    function setActiveTab(tabId: string) {
        activeTabId = tabId;
        dispatch('tabChange', {tabId});
    }

    /**
     * 开始添加标签
     */
    function startAddingTab(mode: typeof inputMode) {
        isAddingTab = true;
        inputMode = mode;
        setTimeout(() => newTabInput?.focus(), 0);
    }

    /**
     * Pro功能检查包装器
     */
    function withProCheck(fn: Function) {
        return (e?: any) => {
            const config = configManager.getConfig();
            if (checkProEnabled(config)) {
                fn(e);
            } else {
                showProFeatureNotEnabledMessage(i18n);
            }
        };
    }

    /**
     * 创建上下文菜单
     */
    function createMenu(menuId: string, items: any[], event: MouseEvent) {
        const menu = new Menu(menuId);
        items.forEach(item => menu.addItem({
            icon: item.icon,
            label: item.label,
            click: () => item.action({event})
        }));
        menu.open({x: event.clientX, y: event.clientY});
    }

    /**
     * 获取菜单显示位置
     */
    function getMenuPosition(event?: MouseEvent) {
        if (event instanceof MouseEvent) {
            return {x: event.clientX, y: event.clientY};
        }
        
        const rect = document.querySelector('.player-area')?.getBoundingClientRect();
        return rect ? 
            {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2} : 
            {x: window.innerWidth / 2, y: window.innerHeight / 2};
    }

    /**
     * 递归处理目录中的媒体文件
     */
    async function processDirectoryHandle(handle: any, basePath: string) {
        if (handle.kind !== 'directory') return 0;
        
        try {
            const entries = await handle.entries();
            let addedCount = 0;
            
            for await (const [name, fileHandle] of entries) {
                if (fileHandle.kind === 'file') {
                    if (MEDIA_FILE_REGEX.test(name)) {
                        if (addMedia(`file://${basePath}/${name}`)) {
                            addedCount++;
                        }
                    }
                } else if (fileHandle.kind === 'directory') {
                    addedCount += await processDirectoryHandle(fileHandle, `${basePath}/${name}`);
                }
            }
            
            return addedCount;
        } catch (error) {
            console.error(i18n.playList.error.processDirectoryFailed, error);
            return 0;
        }
    }

    // ===== 处理程序集合 =====
    
    /**
     * 处理本地文件夹添加
     */
    async function handleLocalFolder(folderPath: string) {
        try {
            const folderName = folderPath.split(/[/\\]/).pop() || i18n.playList.folder.defaultName;
            const tabId = `${TAB_PREFIX.folder}-${TIMESTAMP()}`;
            
            createNewTab(tabId, folderName);
            
            try {
                // @ts-ignore
                const dirHandle = await window.showDirectoryPicker();
                const addedCount = await processDirectoryHandle(dirHandle, folderPath);
                
                showMessage(i18n.playList.message.folderAdded
                    .replace('${name}', dirHandle.name)
                    .replace('${count}', addedCount.toString()));
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
     * 显示B站收藏夹列表
     */
    async function showBiliFavorites(e: any) {
        try {
            const config = await configManager.getConfig();
            
            if (!config.bilibiliLogin?.userInfo?.mid) {
                showMessage(i18n.playList.error.needBiliLogin || '需要登录B站才能获取收藏夹列表');
                return;
            }
            
            const folders = await BilibiliParser.getUserFavoriteFolders(config);
            if (!folders?.length) {
                showMessage(i18n.playList.error.emptyFavFolders || '未找到收藏夹');
                return;
            }
            
            const menu = new Menu("biliFavoritesMenu");
            folders.forEach(folder => {
                menu.addItem({
                    icon: "iconHeart",
                    label: `${folder.title} (${folder.media_count})`,
                    click: () => addBiliFavorite(folder.id.toString(), folder.title)
                });
            });
            
            const position = getMenuPosition(e?.event);
            menu.open(position);
        } catch (error) {
            console.error('获取B站收藏夹列表失败:', error);
            showMessage(i18n.playList.error.getFavFoldersFailed || '获取收藏夹列表失败');
        }
    }

    /**
     * 添加B站收藏夹内容
     */
    async function addBiliFavorite(mediaId: string, title?: string) {
        showMessage(i18n.playList.message.processingFavorites);
        
        try {
            const config = await configManager.getConfig();
            const {title: favTitle, items} = await BilibiliParser.getFavoritesList(mediaId, config);
            
            if (!items?.length) {
                showMessage(i18n.playList.error.emptyFavorites);
                return;
            }
            
            // 创建新标签并添加视频
            const tabId = `${TAB_PREFIX.biliFav}-${TIMESTAMP()}`;
            const tabName = title || favTitle;
            createNewTab(tabId, tabName);
            
            let addedCount = 0;
            // 使用Promise.all并行处理添加操作以提高性能
            await Promise.all(items.map(async item => {
                try {
                    if (addMedia(`https://www.bilibili.com/video/${item.bvid}`)) {
                        addedCount++;
                    }
                } catch (error) {
                    console.error(`添加视频 ${item.bvid} 失败:`, error);
                }
            }));
            
            showMessage(i18n.playList.message.favoritesAdded
                .replace('${name}', tabName)
                .replace('${count}', addedCount.toString()));
        } catch (error) {
            console.error(i18n.playList.error.processFavoritesFailed, error);
            showMessage(i18n.playList.error.processFavoritesFailed);
        }
    }

    // ===== 对象集合 =====
    
    /**
     * 标签操作集合
     */
    const tabActions = {
        // 添加新标签
        add: () => startAddingTab('normal'),

        // 保存标签
        save(event: KeyboardEvent | FocusEvent, tab?: PlaylistConfig) {
            // 仅处理Enter键或失焦事件
            if (event instanceof KeyboardEvent && event.key !== 'Enter') return;
            
            const input = event.target as HTMLInputElement;
            const newName = input.value.trim();
            
            if (tab) {
                // 编辑现有标签
                tabs = tabs.map(t => t.id === tab.id 
                    ? {...t, name: newName || t.name, isEditing: false} 
                    : t
                );
                updateTabs();
            } else if (newName) {
                // 处理特殊输入模式
                const handlers = {
                    normal: () => createNewTab(`${TAB_PREFIX.normal}-${TIMESTAMP()}`, newName),
                    localFolder: () => handleLocalFolder(newName)
                };
                
                handlers[inputMode]?.();
                isAddingTab = false;
            } else {
                // 空输入取消添加
                isAddingTab = false;
            }
            
            input.value = '';
        },

        // 显示标签上下文菜单
        showContextMenu(event: MouseEvent, tab: PlaylistConfig) {
            const menuItems = [];
            const actions = {
                // 重命名标签
                rename: () => {
                    tabs = tabs.map(t => ({...t, isEditing: t.id === tab.id}));
                    updateTabs();
                    setTimeout(() => {
                        const input = document.querySelector(`#tab-edit-${tab.id}`) as HTMLInputElement;
                        input?.focus();
                        input?.select();
                    }, 0);
                },
                // 删除标签
                delete: () => {
                    tabs = tabs.filter(t => t.id !== tab.id);
                    if (activeTabId === tab.id) setActiveTab('default');
                    updateTabs();
                },
                // 清空标签内容
                clear: () => {
                    tabs = tabs.map(t => t.id === tab.id ? {...t, items: []} : t);
                    updateTabs();
                    showMessage(i18n.playList.message.listCleared.replace('${name}', tab.name));
                }
            };
            
            // 非固定标签可以重命名和删除
            if (!tab.isFixed) {
                menuItems.push(
                    {icon: "iconEdit", label: i18n.playList.menu.rename, action: actions.rename},
                    {icon: "iconTrashcan", label: i18n.playList.menu.delete, action: actions.delete}
                );
            }
            
            // 所有标签都可以清空
            menuItems.push({icon: "iconClear", label: i18n.playList.menu.clear, action: actions.clear});
            createMenu("tabContextMenu", menuItems, event);
        }
    };

    /**
     * 菜单配置
     */
    const menuConfigs = {
        addTab: [
            { icon: "iconFolder", label: i18n.playList.menu.addLocalFolder, 
              action: withProCheck(() => startAddingTab('localFolder')) },
            { icon: "iconCloud", label: i18n.playList.menu.addAliCloud, 
              action: () => showMessage(i18n.playList.message.notImplemented) },
            { icon: "iconCloud", label: i18n.playList.menu.addTianYiCloud, 
              action: () => showMessage(i18n.playList.message.notImplemented) },
            { icon: "iconCloud", label: i18n.playList.menu.addQuarkCloud, 
              action: () => showMessage(i18n.playList.message.notImplemented) },
            { icon: "iconHeart", label: i18n.playList.menu.addBilibiliFavorites, 
              action: withProCheck(showBiliFavorites) }
        ]
    };

    // ===== 生命周期 =====
    
    // 处理B站登录状态变化
    function handleBiliLoginStatusChange(_event: CustomEvent<{isLoggedIn: boolean; userInfo: any}>) {
        // 由于状态已通过config.bilibiliLogin获取，这里为空函数，但保留监听
    }

    onMount(() => {
        window.addEventListener('biliLoginStatusChange', handleBiliLoginStatusChange as EventListener);
    });
    
    onDestroy(() => {
        window.removeEventListener('biliLoginStatusChange', handleBiliLoginStatusChange as EventListener);
    });
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
                placeholder={
                    inputMode === 'localFolder' 
                        ? i18n.playList.placeholder.folderPath 
                        : i18n.playList.placeholder.newTab
                }
                on:blur={tabActions.save}
                on:keydown={tabActions.save}
            />
        {:else}
            <button 
                class="tab tab-add" 
                on:click={tabActions.add}
                on:contextmenu|preventDefault={(e) => createMenu("addTabMenu", menuConfigs.addTab, e)}
            >+</button>
        {/if}
    </div>
</div>

<style>
    /* 原有样式保持不变 */
</style>