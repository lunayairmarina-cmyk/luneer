import connectDB from '@/lib/db';
import Service, { IService, IServiceBenefit } from '@/models/Service';
import { Types } from 'mongoose';
import { readState } from '@/lib/localDbHelper';

export type LocalizedText = {
    en: string;
    ar: string;
};

export type ServiceBenefitDto = {
    id: string;
    icon?: string | null;
    title: LocalizedText;
    description: LocalizedText;
};

export type ServiceGalleryDto = {
    id: string;
    url: string;
    caption: LocalizedText;
};

export type ServiceSummaryDto = {
    id: string;
    slug: string;
    title: LocalizedText;
    description: LocalizedText;
    image?: string | null;
    price?: string | null;
    priceAr?: string | null;
};

export type ServiceDetailDto = {
    id: string;
    slug: string;
    title: LocalizedText;
    description: LocalizedText;
    longDescription: LocalizedText;
    heroBadge: LocalizedText;
    heroTitle: LocalizedText;
    features: {
        en: string[];
        ar: string[];
    };
    benefits: ServiceBenefitDto[];
    advantages: ServiceBenefitDto[];
    extra1: {
        enabled: boolean;
        title: LocalizedText;
        description: LocalizedText;
    };
    extra2: {
        enabled: boolean;
        title: LocalizedText;
        description: LocalizedText;
    };
    gallery: ServiceGalleryDto[];
    mainImage?: string | null;
    price?: string | null;
    priceAr?: string | null;
    category?: string | null;
    meta: {
        title: string;
        description: string;
        image?: string | null;
    };
    titles: {
        advantages: LocalizedText;
        benefits: LocalizedText;
    };
    sectionOrder: string[];
};

export type ServiceDetailResponse = {
    service: ServiceDetailDto;
    relatedServices: ServiceSummaryDto[];
};

const imageUrl = (id?: string | null) => (id ? `/api/images/${id}` : null);

const resolveMedia = (value?: string | null) => {
    if (!value || typeof value !== 'string') {
        return null;
    }
    if (value.startsWith('http') || value.startsWith('/')) {
        return value;
    }
    return imageUrl(value);
};

const localizedPair = (
    en?: string,
    ar?: string,
    fallbackEn?: string,
    fallbackAr?: string
): LocalizedText => ({
    en: en ?? fallbackEn ?? '',
    ar: ar ?? fallbackAr ?? en ?? fallbackEn ?? '',
});

function sortGallery(gallery?: IService['gallery'] | null) {
    const list = gallery || [];
    return [...list].sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA === orderB) {
            return a.fileId.localeCompare(b.fileId);
        }
        return orderA - orderB;
    });
}

function normalizeService(service: any): ServiceDetailDto {
    const plain = typeof service.toObject === 'function' ? service.toObject() : service;
    const id = plain._id.toString();

    const gallery = sortGallery(plain.gallery).map((item) => ({
        id: item.fileId,
        url: imageUrl(item.fileId) ?? '',
        caption: localizedPair(item.caption, item.captionAr, plain.title, plain.titleAr),
    }));

    const benefits = (Array.isArray(plain.benefits) ? plain.benefits : []).map((benefit: IServiceBenefit, index: number) => ({
        id: `${id}-benefit-${index}`,
        icon: resolveMedia(benefit.icon),
        title: localizedPair(benefit.title, benefit.titleAr, plain.title, plain.titleAr),
        description: localizedPair(benefit.description, benefit.descriptionAr, plain.description, plain.descriptionAr),
    }));

    const advantages = (Array.isArray(plain.advantages) ? plain.advantages : []).map((advantage: IServiceBenefit, index: number) => ({
        id: `${id}-advantage-${index}`,
        icon: resolveMedia(advantage.icon),
        title: localizedPair(advantage.title, advantage.titleAr, plain.title, plain.titleAr),
        description: localizedPair(advantage.description, advantage.descriptionAr, plain.description, plain.descriptionAr),
    }));

    const featuresEn = Array.isArray(plain.features) && plain.features.length > 0 ? plain.features : [];
    const featuresAr =
        Array.isArray(plain.featuresAr) && plain.featuresAr.length > 0
            ? plain.featuresAr
            : featuresEn;

    return {
        id,
        slug: plain.slug || id,
        title: localizedPair(plain.title, plain.titleAr),
        description: localizedPair(plain.description, plain.descriptionAr),
        longDescription: localizedPair(
            plain.detailedDescription ?? plain.description,
            plain.detailedDescriptionAr ?? plain.descriptionAr,
            plain.description,
            plain.descriptionAr
        ),
        heroBadge: localizedPair(plain.heroBadge, plain.heroBadgeAr, 'Service', 'خدمة'),
        heroTitle: localizedPair(plain.heroTitle, plain.heroTitleAr, plain.title, plain.titleAr),
        features: {
            en: featuresEn,
            ar: featuresAr,
        },
        benefits,
        advantages,
        extra1: {
            enabled: plain.extra1Enabled ?? false,
            title: localizedPair(plain.extra1Title, plain.extra1TitleAr, '', ''),
            description: localizedPair(plain.extra1Description, plain.extra1DescriptionAr, '', ''),
        },
        extra2: {
            enabled: plain.extra2Enabled ?? false,
            title: localizedPair(plain.extra2Title, plain.extra2TitleAr, '', ''),
            description: localizedPair(plain.extra2Description, plain.extra2DescriptionAr, '', ''),
        },
        gallery,
        mainImage: resolveMedia(plain.image),
        price: plain.price ?? null,
        priceAr: plain.priceAr ?? null,
        category: plain.category ?? null,
        meta: {
            title: plain.metaTitle ?? plain.title,
            description: plain.metaDescription ?? plain.description,
            image: resolveMedia(plain.seoImage ?? plain.image),
        },
        titles: {
            advantages: localizedPair(plain.advantagesTitle, plain.advantagesTitleAr),
            benefits: localizedPair(plain.benefitsTitle, plain.benefitsTitleAr)
        },
        sectionOrder: plain.sectionOrder ?? ['benefits', 'advantages', 'extra1', 'extra2']
    };
}

function normalizeSummary(service: any): ServiceSummaryDto {
    const plain = typeof service.toObject === 'function' ? service.toObject() : service;
    const id = plain._id.toString();
    return {
        id,
        slug: plain.slug || id,
        title: localizedPair(plain.title, plain.titleAr),
        description: localizedPair(plain.description, plain.descriptionAr),
        image: resolveMedia(plain.image),
        price: plain.price ?? null,
        priceAr: plain.priceAr ?? null,
    };
}

export async function getServiceDetail(identifier: string): Promise<ServiceDetailResponse | null> {
    await connectDB();
    
    let query: any = { slug: identifier };
    if (Types.ObjectId.isValid(identifier)) {
        query = { $or: [{ slug: identifier }, { _id: new Types.ObjectId(identifier) }] };
    }

    const serviceDoc = await Service.findOne(query).exec();
    if (!serviceDoc) {
        return null;
    }
    const normalizedService = normalizeService(serviceDoc);
    
    // Find related services of the same category
    const relatedDocs = await Service.find({
        _id: { $ne: serviceDoc._id },
        category: serviceDoc.category
    })
    .limit(4)
    .exec();

    const related = relatedDocs.map(normalizeSummary);

    return {
        service: normalizedService,
        relatedServices: related,
    };
}

