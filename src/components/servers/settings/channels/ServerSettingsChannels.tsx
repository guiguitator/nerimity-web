import styles from './styles.module.scss'
import RouterEndpoints from '@/common/RouterEndpoints';
import { Link, useNavigate, useParams } from '@solidjs/router';
import { createEffect, createMemo, createSignal, For, Match, on, onMount, Switch } from 'solid-js';
import useStore from '@/chat-api/store/useStore';
import SettingsBlock from '@/components/ui/settings-block/SettingsBlock';
import Button from '@/components/ui/Button';
import useChannels, { Channel } from '@/chat-api/store/useChannels';
import Icon from '@/components/ui/icon/Icon';
import { createServerChannel, updateServerChannelOrder } from '@/chat-api/services/ServerService';
import { useTransContext } from '@nerimity/solid-i18next';
import Sortable from 'solid-sortablejs';
import ContextMenu, { ContextMenuProps } from '@/components/ui/context-menu/ContextMenu';
import { ChannelType } from '@/chat-api/RawData';
import { CustomLink } from '@/components/ui/CustomLink';




function ChannelItem(props: { channel: Channel }) {
  const { serverId } = useParams();

  const link = RouterEndpoints.SERVER_SETTINGS_CHANNEL(serverId, props.channel.id);

  return (
    <CustomLink href={link} class={styles.channelItem}>
      <div class={styles.container}>
        <Icon name='textsms' color='rgba(255,255,255,0.6)' size={18} />
        <div class={styles.name}>{props.channel.name}</div>
        <Icon name='navigate_next' />
      </div>
    </CustomLink>
  )
}
function CategoryItem(props: { channel: Channel }) {
  const { serverId } = useParams();
  const { channels } = useStore();

  const link = RouterEndpoints.SERVER_SETTINGS_CHANNEL(serverId, props.channel.id);

  const sortedServerChannels = createMemo(() => channels.getSortedChannelsByServerId(serverId) as unknown as Channel[]);
  const categoryChannels = createMemo(() => sortedServerChannels().filter(channel => channel!.categoryId === props.channel.id));

  const [temp, setTemp, resetTemp] = createTemporarySignal(categoryChannels);


  const onAdd = () => {
    updateServerChannelOrder(serverId, {
      channelIds: temp().map(c => c.id),
      categoryId: props.channel.id
    }).finally(resetTemp)
  }

  const onEnd = (event: any) => {
    if (event.to !== event.from) return;
    updateServerChannelOrder(serverId, {
      channelIds: temp().map(c => c.id),
      categoryId: props.channel.id,
    }).finally(resetTemp)
  }



  return (
    <div class={styles.channelItem}>
      <CustomLink href={link} class={styles.container}>
        <Icon name='segment' color='rgba(255,255,255,0.6)' size={18} />
        <div class={styles.name}>{props.channel.name}</div>
        <Icon name='navigate_next' />
      </CustomLink>
      <div class={styles.categoryChannels}>
        <Sortable group='manage-channels' class={styles.channelList} setItems={setTemp} onEnd={onEnd} onAdd={onAdd} items={temp()} idField="id">
          {channel => <ChannelItem channel={channel!} />}
        </Sortable>
      </div>
    </div>
  )
}


function ChannelList() {
  const { serverId } = useParams();
  const { channels } = useStore();
  const sortedServerChannels = createMemo(() => channels.getSortedChannelsByServerId(serverId) as unknown as Channel[]);
  const sortedServerChannelsWithoutCategoryChannels = createMemo(() => sortedServerChannels().filter(channel => !channel!.categoryId));
  const [temp, setTemp, resetTemp] = createTemporarySignal(sortedServerChannelsWithoutCategoryChannels);



  const onEnd = (event: any) => {
    if (event.to !== event.from) return;
    updateServerChannelOrder(serverId, {
      channelIds: temp().map(c => c.id)
    }).finally(resetTemp)
  }

  const onAdd = () => {
    updateServerChannelOrder(serverId, {
      channelIds: temp().map(c => c.id)
    }).finally(resetTemp)
  }


  const onMove = (event: any) => {
    const channelId = event.dragged.dataset.id;
    const channel = channels.get(channelId);
    if (channel?.type === ChannelType.CATEGORY && event.to !== event.from) return false;
  }


  return (
    <Sortable group='manage-channels' class={styles.channelList} onMove={onMove} onAdd={onAdd} onEnd={onEnd} setItems={setTemp} items={temp()} idField="id">
      {channel => (
        <Switch>
          <Match when={channel.type === ChannelType.SERVER_TEXT}>
            <ChannelItem channel={channel!} />
          </Match>
          <Match when={channel.type === ChannelType.CATEGORY}>
            <CategoryItem channel={channel!} />
          </Match>
        </Switch>
      )}
    </Sortable>
  )
}

function createTemporarySignal<T>(v: () => T) {
  const [value, setValue] = createSignal(v());
  createEffect(on(v, () => setValue(v)))

  const resetValue = () => setValue(v);

  return [value, setValue, resetValue] as const
}


export default function ServerSettingsChannel() {
  const [t] = useTransContext();
  const { serverId } = useParams();
  const { header } = useStore();
  const [channelAddRequestSent, setChannelAddRequestSent] = createSignal(false);
  const navigate = useNavigate();
  const [contextMenuPos, setContextMenuPos] = createSignal<null | { x: number; y: number }>(null);

  onMount(() => {
    header.updateHeader({
      title: "Settings - Channels",
      serverId: serverId!,
      iconName: 'settings'
    });
  })

  const onAddChannelClicked = (event: MouseEvent) => {
    setContextMenuPos(!contextMenuPos() ? {
      x: event.clientX,
      y: event.clientY,
    } : null)

  }
  const createChannel = async (type: ChannelType) => {
    if (channelAddRequestSent()) return;
    setChannelAddRequestSent(true);

    const channel = await createServerChannel({ serverId, type })
      .finally(() => setChannelAddRequestSent(false))

    navigate(RouterEndpoints.SERVER_SETTINGS_CHANNEL(serverId!, channel.id))
  }


  return (
    <div class={styles.channelsPane}>
      <SettingsBlock label={t('servers.settings.channels.createNewDescription')} icon='add'>
        <Button label={t('servers.settings.channels.createButton')} class='createButton' onClick={onAddChannelClicked} />
        <ContextMenuCreate onClick={item => createChannel(item.id!)} triggerClassName='createButton' onClose={() => setContextMenuPos(null)} position={contextMenuPos()} />
      </SettingsBlock>
      <ChannelList />
    </div>
  )
}




function ContextMenuCreate(props: Omit<ContextMenuProps, "items">) {

  return (
    <ContextMenu {...props} items={[
      { icon: 'textsms', label: "Text Channel", id: 1 },
      { icon: 'segment', label: "Category", id: 2 },
    ]} />
  )
}