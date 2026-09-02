// Экран этого продукта внутри «Коробки» (одно приложение на все продукты).
//
// Правило: расчёт здесь — построчный перенос lib/calc.js, и он обязан давать
// те же числа на тех же кейсах из product.json. Расходятся числа — расходятся
// веб и приложение, а узнает об этом посетитель.
//
// Файл забирается в приложение-коробку скриптом toolbox/bin/sync-tools.mjs,
// он же кладёт кейсы в toolbox/test/. Здесь никаких импортов из коробки:
// файл должен оставаться самодостаточным.

import 'package:flutter/material.dart';

const toolMeta = ToolMeta(
  slug: 'costyouhaus',
  name: 'Сколько стоит ваш час',
  tagline: 'Из желаемого дохода, отпуска и расходов считает честную ставку. Больше не соглашаетесь на первую названную цифру.',
  category: 'Калькуляторы и конвертеры',
);

class ToolMeta {
  const ToolMeta({
    required this.slug,
    required this.name,
    required this.tagline,
    required this.category,
  });

  final String slug;
  final String name;
  final String tagline;
  final String category;
}

/// Тот же расчёт, что в lib/calc.js. Чистая функция — её проверяют кейсами.
Map<String, num> calc(Map<String, num> input) {
  // PLACEHOLDER: перенести расчёт из lib/calc.js.
  final a = input['a'] ?? 0;
  return {'value': a};
}

class ToolScreen extends StatefulWidget {
  const ToolScreen({super.key});

  @override
  State<ToolScreen> createState() => _ToolScreenState();
}

class _ToolScreenState extends State<ToolScreen> {
  final _fields = <String, TextEditingController>{
    // PLACEHOLDER: по одному контроллеру на поле из product.json:inputs.
    'a': TextEditingController(text: '0'),
  };

  Map<String, num> get _input =>
      _fields.map((k, c) => MapEntry(k, num.tryParse(c.value.text) ?? 0));

  @override
  void dispose() {
    for (final c in _fields.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final out = calc(_input);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(toolMeta.name)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(toolMeta.tagline, style: theme.textTheme.bodyMedium),
          const SizedBox(height: 16),
          for (final entry in _fields.entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TextField(
                controller: entry.value,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: entry.key, // PLACEHOLDER: подпись поля из манифеста
                  border: const OutlineInputBorder(),
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Text(
                '${out['value']}',
                style: theme.textTheme.displaySmall,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
