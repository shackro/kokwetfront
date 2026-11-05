import { useEffect, useState } from 'react';
import { getJson, postJson } from '../api';
import { defaultArtists, shieldImageSets, shieldNodes } from '../features/home/data';
import HeroSection from '../features/home/HeroSection';
import CommunitySpotlight from '../features/home/CommunitySpotlight';
import EventBoard from '../features/home/EventBoard';
import FeaturedArtists from '../features/home/FeaturedArtists';
import EnterpriseShowcase from '../features/home/EnterpriseShowcase';
import PassesSection from '../features/home/PassesSection';
import JoinCta from '../features/home/JoinCta';
import PokotFestPromotion from '../features/home/PokotFestPromotion';
import TicketDrawer from '../components/TicketDrawer';
import { useSiteContent } from '../siteContent';

export default function HomePage(){
  const [activeShieldNode,setActiveShieldNode]=useState(shieldNodes[0]);
  const [shieldImageSetIndex,setShieldImageSetIndex]=useState(0);
  const [activities,setActivities]=useState([]);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{getJson('/activities').then(setActivities).catch(()=>setActivities([]))},[]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[]);
  const [passes,setPasses]=useState([]);
  const [ticketDrawerOpen,setTicketDrawerOpen]=useState(false);
  const [initialPassId,setInitialPassId]=useState(null);
  const { content: siteContent } = useSiteContent();
  const artists=siteContent?.artists || defaultArtists;
  const shieldNodesContent=siteContent?.home?.shield?.nodes || shieldNodes;
  const configuredImageSets=siteContent?.home?.shield?.image_sets?.map(imageSet=>imageSet.images) || shieldImageSets;
  const rotationInterval=siteContent?.home?.shield?.rotation_interval_seconds || 60;
  const activeShieldNodeContent=shieldNodesContent.find(node=>node.id===activeShieldNode.id) || shieldNodesContent[0];
  useEffect(()=>{
    const timer=window.setInterval(()=>setShieldImageSetIndex(index=>(index+1)%configuredImageSets.length),rotationInterval*1000);
    return ()=>window.clearInterval(timer);
  },[configuredImageSets.length,rotationInterval]);
  useEffect(()=>{getJson('/passes').then(setPasses).catch(()=>setPasses([]))},[]);
  function openTickets(passId=null){setInitialPassId(passId);setTicketDrawerOpen(true)}
  async function checkout(items,phone){return postJson('/checkout/cart',{items,phone})}
  const festivalEvent=activities.find(event=>event.is_main_event);
  const pokotFestEvent=activities.find(event=>event.slug==='pokotfest');
  const countdown=festivalEvent?Math.max(0,Date.parse(festivalEvent.date)-now):0;
  const countdownParts=[
    [Math.floor(countdown/86400000),'days'],
    [Math.floor(countdown%86400000/3600000),'hours'],
    [Math.floor(countdown%3600000/60000),'minutes'],
    [Math.floor(countdown%60000/1000),'seconds'],
  ];
  const visibleShieldImages=configuredImageSets[shieldImageSetIndex % configuredImageSets.length];
  return (
    <>
      <HeroSection
        festivalEvent={festivalEvent}
        activeShieldNode={activeShieldNodeContent}
        setActiveShieldNode={setActiveShieldNode}
        shieldImageSetIndex={shieldImageSetIndex}
        visibleShieldImages={visibleShieldImages}
        shieldNodes={shieldNodesContent}
        heroContent={siteContent?.home?.hero}
        shieldContent={siteContent?.home?.shield}
        logoUrl={siteContent?.settings?.logo_wordmark_light_url}
        onGetTickets={() => openTickets()}
      />
      {pokotFestEvent&&<PokotFestPromotion event={pokotFestEvent} now={now}/>}
      <CommunitySpotlight content={siteContent?.home?.community} />
      <EventBoard activities={activities} sectionContent={siteContent?.home?.events_section} />
      <FeaturedArtists artists={artists} sectionContent={siteContent?.home?.artists_section} />
      <EnterpriseShowcase content={siteContent?.home?.enterprise_section} enterprises={siteContent?.home?.enterprises || []} />
      <PassesSection
        mainEvent={festivalEvent}
        countdownParts={countdownParts}
        passes={passes}
        openTickets={openTickets}
        sectionContent={siteContent?.home?.pass_section}
      />
      <TicketDrawer
        isOpen={ticketDrawerOpen}
        onClose={()=>setTicketDrawerOpen(false)}
        passes={passes}
        event={festivalEvent}
        initialPassId={initialPassId}
        onCheckout={checkout}
      />
      <JoinCta content={siteContent?.home?.join} />
    </>
  );
}
