import ByteBloom from '../bytebloom';
export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) { const { slug = [] } = await params; return <ByteBloom path={'/' + slug.join('/')} />; }
