import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useEvent, useAuth, createItem } from 'shared';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ITEM_CATEGORIES, CATEGORY_LABELS } from 'shared';

export default function AddItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { event, loading: eventLoading } = useEvent(id);
  const { user } = useAuth();
  const router = useRouter();
  
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [reducedPrice, setReducedPrice] = useState('');
  const [enablePriceReduction, setEnablePriceReduction] = useState(false);
  const [donateIfUnsold, setDonateIfUnsold] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !event) return;

    // Validation
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    const price = parseFloat(originalPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }
    if (enablePriceReduction) {
      const reduced = parseFloat(reducedPrice);
      if (isNaN(reduced) || reduced <= 0 || reduced >= price) {
        Alert.alert('Error', 'Reduced price must be less than original price');
        return;
      }
    }

    setSubmitting(true);
    try {
      await createItem(user.id, event.id, {
        category,
        description: description.trim(),
        size: size.trim() || undefined,
        originalPrice: price,
        reducedPrice: enablePriceReduction ? parseFloat(reducedPrice) : undefined,
        enablePriceReduction,
        donateIfUnsold,
      });

      Alert.alert(
        'Success',
        'Item added successfully!',
        [
          {
            text: 'Add Another',
            onPress: () => {
              // Reset form
              setCategory('');
              setDescription('');
              setSize('');
              setOriginalPrice('');
              setReducedPrice('');
              setEnablePriceReduction(false);
              setDonateIfUnsold(false);
            },
          },
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  if (eventLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!event || !user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Item</Text>
        <Text style={styles.subtitle}>{event.name}</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {ITEM_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  category === cat && styles.categoryChipSelected,
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    category === cat && styles.categoryChipTextSelected,
                  ]}
                >
                  {CATEGORY_LABELS[cat]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g., Mountain bike, size medium, excellent condition"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Size (optional)</Text>
          <TextInput
            style={styles.textInput}
            value={size}
            onChangeText={setSize}
            placeholder="e.g., Medium, 10, Large"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Original Price *</Text>
          <View style={styles.priceInputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.priceInput}
              value={originalPrice}
              onChangeText={setOriginalPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setEnablePriceReduction(!enablePriceReduction)}
          >
            <View style={[styles.checkbox, enablePriceReduction && styles.checkboxChecked]}>
              {enablePriceReduction && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Enable automatic price reduction</Text>
          </TouchableOpacity>
          {enablePriceReduction && (
            <View style={styles.reducedPriceContainer}>
              <Text style={styles.label}>Reduced Price</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={reducedPrice}
                  onChangeText={setReducedPrice}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.field}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setDonateIfUnsold(!donateIfUnsold)}
          >
            <View style={[styles.checkbox, donateIfUnsold && styles.checkboxChecked]}>
              {donateIfUnsold && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Donate if unsold</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Your item will be reviewed at check-in. Make sure all information is accurate.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Add Item</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    padding: 20,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  categoryScroll: {
    marginHorizontal: -4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    minHeight: 80,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingLeft: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  reducedPriceContainer: {
    marginTop: 12,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC3545',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

